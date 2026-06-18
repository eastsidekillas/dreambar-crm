from decimal import Decimal, ROUND_DOWN, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.shifts.models import Shift
from apps.receipts.models import Receipt
from apps.tables.utils import table_segments
from apps.printers.models import Printer
from apps.audit.models import DeletedOrderItem
from apps.users.permissions_matrix import HasPerm, Perm, has_perm
from ..models import Order, OrderItem, OrderGlassware
from ..serializers import OrderSerializer, OrderCreateSerializer, OrderItemCreateSerializer, ReceiptSerializer
from apps.printers.services import printing
from apps.inventory.services import deduct_for_receipt


def _distribute(amount, weights):
    """Распределить amount пропорционально weights; копейки — методом наибольшего остатка.
    Сумма результата строго равна amount (если amount>0 и есть положительные веса)."""
    total = sum(weights)
    if amount <= 0 or total <= 0:
        return [Decimal(0) for _ in weights]
    cent = Decimal('0.01')
    raw = [amount * w / total for w in weights]
    rounded = [r.quantize(cent, rounding=ROUND_DOWN) for r in raw]
    remainder = amount - sum(rounded)
    # Раздаём остаток по убыванию дробной части.
    for i in sorted(range(len(weights)), key=lambda k: raw[k] - rounded[k], reverse=True):
        if remainder < cent:
            break
        rounded[i] += cent
        remainder -= cent
    return rounded


def _issue_receipt(order, items, payment_method, user, deposit_amount=Decimal(0), deposit_method='', refund_amount=Decimal(0)):
    total = sum(it.subtotal for it in items)
    receipt = Receipt.objects.create(
        order=order,
        shift=order.shift,
        number=Receipt.next_number(order.shift),
        table_number=order.table_number,
        waiter=order.waiter,
        payment_method=payment_method,
        total=total,
        deposit_amount=deposit_amount,
        deposit_method=deposit_method,
        refund_amount=refund_amount,
    )
    OrderItem.objects.filter(pk__in=[it.pk for it in items]).update(receipt=receipt)
    deduct_for_receipt(items, receipt, user=user)

    if not order.items.filter(receipt__isnull=True).exists():
        order.status = 'closed'
        order.closed_at = timezone.now()
        order.save(update_fields=['status', 'closed_at', 'updated_at'])
        # Заказ полностью оплачен → закрываем привязанную бронь (стол освобождается,
        # бронь уходит из «сегодня»). Отменённую/завершённую не трогаем.
        resv = order.reservation
        if resv and resv.status not in ('completed', 'cancelled'):
            resv.status = 'completed'
            resv.save(update_fields=['status'])
    return receipt


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('waiter', 'shift').prefetch_related(
        'items__menu_item__category'
    )
    filterset_fields = ['shift', 'status', 'waiter']

    def get_permissions(self):
        # Заказы ведут только официант/бармен/админ. Кухня и гардероб сюда не ходят.
        return [HasPerm(Perm.ORDER_CREATE)]

    def get_queryset(self):
        # Стандартные list/retrieve/update/destroy: не-админ видит только свои заказы
        # (чужой по прямому id → 404). active/my_orders строят свой queryset и сюда не попадают.
        qs = super().get_queryset()
        if not has_perm(self.request.user, Perm.ORDER_VIEW_ALL):
            qs = qs.filter(waiter=self.request.user)
        return qs

    def _check_order_access(self, order):
        """Действие над заказом разрешено только его официанту; админ (ORDER_EDIT_ANY) — над любым."""
        user = self.request.user
        if order.waiter_id != user.id and not has_perm(user, Perm.ORDER_EDIT_ANY):
            raise PermissionDenied('Это заказ другого сотрудника.')

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer

    def perform_create(self, serializer):
        serializer.save(waiter=self.request.user)

    def create(self, request, *args, **kwargs):
        """Открыть стол с защитой от гонки: один открытый заказ на стол.
        Параллельные открытия сериализуем локом строки смены, затем проверяем,
        что запрошенные столы не пересекаются с уже открытыми заказами → иначе 409."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shift = serializer.validated_data.get('shift')
        table_number = str(serializer.validated_data.get('table_number', ''))
        requested = set(table_segments(table_number))
        with transaction.atomic():
            if shift is not None and requested:
                # Лок строки смены — сериализует параллельные открытия в рамках смены.
                Shift.objects.select_for_update().filter(pk=shift.pk).first()
                for o in Order.objects.filter(shift=shift, status='open'):
                    clash = requested & set(table_segments(o.table_number))
                    if clash:
                        return Response(
                            {'detail': f'Стол {", ".join(sorted(clash))} уже занят другим официантом.'},
                            status=status.HTTP_409_CONFLICT)
            self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        """Освободить стол можно, только если по нему ничего не заказывали (пустой открытый заказ)."""
        order = self.get_object()   # get_queryset ограничивает не-админа своими заказами → чужой 404
        if order.status != 'open':
            return Response({'detail': 'Освободить можно только открытый стол.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if order.items.exists() or order.receipts.exists():
            return Response({'detail': 'На столе есть заказ — стол нельзя удалить.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        payment_method = request.data.get('payment_method', 'cash')
        deposit_amount = Decimal(str(request.data.get('deposit_amount') or 0))
        deposit_method = request.data.get('deposit_method', '')
        if deposit_amount < 0:
            return Response({'detail': 'deposit_amount не может быть отрицательным.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ уже закрыт или отменён.'}, status=status.HTTP_400_BAD_REQUEST)
            unpaid = list(order.items.filter(receipt__isnull=True))
            if not unpaid:
                return Response({'detail': 'В заказе нет позиций для чека.'}, status=status.HTTP_400_BAD_REQUEST)
            receipt = _issue_receipt(order, unpaid, payment_method, request.user,
                                     deposit_amount=deposit_amount, deposit_method=deposit_method)
        return Response({
            'order': OrderSerializer(order).data,
            'receipt': ReceiptSerializer(receipt).data,
        })

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        bills_data = request.data.get('bills')

        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ уже закрыт или отменён.'}, status=status.HTTP_400_BAD_REQUEST)

            unpaid = {it.pk: it for it in order.items.filter(receipt__isnull=True)}
            if not unpaid:
                return Response({'detail': 'Все позиции уже оплачены.'}, status=status.HTTP_400_BAD_REQUEST)

            bills = bills_data
            if not bills:
                item_ids = request.data.get('item_ids')
                bills = [{
                    'item_ids': item_ids if item_ids else list(unpaid.keys()),
                    'payment_method': request.data.get('payment_method', 'cash'),
                }]

            seen = set()
            for bill in bills:
                ids = bill.get('item_ids') or []
                if not ids:
                    return Response({'detail': 'Пустой чек недопустим.'}, status=status.HTTP_400_BAD_REQUEST)
                for i in ids:
                    if i not in unpaid:
                        return Response({'detail': f'Позиция {i} недоступна для оплаты.'}, status=status.HTTP_400_BAD_REQUEST)
                    if i in seen:
                        return Response({'detail': f'Позиция {i} указана в нескольких чеках.'}, status=status.HTTP_400_BAD_REQUEST)
                    seen.add(i)

            # ── Депозит как общий баланс стола (источник — бронь заказа) ──
            # Остаток = депозит брони − уже списано в прошлых чеках. На этот расчёт списываем
            # min(остаток, сумма счетов), распределяя пропорционально по чекам. Возврат
            # неиспользованного депозита — только при ПОЛНОМ закрытии заказа.
            resv = order.reservation
            resv_deposit = resv.deposit_amount if (resv and resv.deposit_paid) else Decimal(0)
            # Депозит брони + депозит, внесённый официантом за столом — общий баланс.
            total_deposit = resv_deposit + (order.deposit_amount or Decimal(0))
            used = order.receipts.aggregate(s=Sum('deposit_amount'))['s'] or Decimal(0)
            remaining = max(Decimal(0), total_deposit - used)
            deposit_method = order.deposit_method or (resv.deposit_method if resv else '')

            bill_totals = [sum(unpaid[i].subtotal for i in bill['item_ids']) for bill in bills]
            current_total = sum(bill_totals)
            apply_total = min(remaining, current_total)
            per_bill_deposit = _distribute(apply_total, bill_totals)

            closes = len(seen) == len(unpaid)
            refund = (remaining - current_total) if (closes and remaining > current_total) else Decimal(0)

            receipts = []
            for idx, bill in enumerate(bills):
                d_amt = per_bill_deposit[idx]
                receipts.append(
                    _issue_receipt(order, [unpaid[i] for i in bill['item_ids']],
                                   bill.get('payment_method', 'cash'), request.user,
                                   deposit_amount=d_amt,
                                   deposit_method=(deposit_method if d_amt > 0 else ''),
                                   refund_amount=(refund if idx == 0 else Decimal(0)))
                )
        return Response({
            'order': OrderSerializer(order).data,
            'receipts': ReceiptSerializer(receipts, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response([])
        qs = Order.objects.filter(
            shift=shift, status='open',
        ).select_related(
            'waiter', 'waiter__profile'
        ).prefetch_related('items__menu_item__category', 'receipts__items').order_by('created_at')
        return Response(OrderSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ уже закрыт или отменён.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.receipts.exists():
                return Response({'detail': 'По заказу уже выбиты чеки — отмена невозможна.'}, status=status.HTTP_400_BAD_REQUEST)
            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        serializer = OrderItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Нельзя добавить в закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
            # Позиция добавляется как черновик — на кухню/бар уйдёт только после «Отправить».
            item = serializer.save(order=order)
            OrderItem.objects.filter(pk=item.pk).update(is_sent=False)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Отправить черновые позиции на кухню/бар (пометить is_sent)."""
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ не открыт.'}, status=status.HTTP_400_BAD_REQUEST)
            sent = order.items.filter(is_sent=False, receipt__isnull=True).update(is_sent=True)
        return Response({'order': OrderSerializer(order).data, 'sent': sent})

    @action(detail=True, methods=['delete'], url_path='remove_item/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Нельзя изменить закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                item = order.items.get(pk=item_id)
            except OrderItem.DoesNotExist:
                return Response({'detail': 'Позиция не найдена.'}, status=status.HTTP_404_NOT_FOUND)
            if item.receipt_id is not None:
                return Response({'detail': 'Позиция уже оплачена — удаление невозможно.'}, status=status.HTTP_400_BAD_REQUEST)
            DeletedOrderItem.objects.create(
                order=order,
                shift=order.shift,
                deleted_by=request.user,
                table_number=order.table_number,
                menu_item_name=item.menu_item.name,
                menu_item_volume=item.menu_item.volume,
                quantity=item.quantity,
                unit_price=item.unit_price,
                kitchen_status=item.kitchen_status,
            )
            item.delete()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='item/(?P<item_id>[^/.]+)/update')
    def update_item(self, request, pk=None, item_id=None):
        """Изменить количество и/или комментарий позиции."""
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Нельзя изменить закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                item = order.items.get(pk=item_id)
            except OrderItem.DoesNotExist:
                return Response({'detail': 'Позиция не найдена.'}, status=status.HTTP_404_NOT_FOUND)
            if item.receipt_id is not None:
                return Response({'detail': 'Позиция уже оплачена.'}, status=status.HTTP_400_BAD_REQUEST)
            fields = []
            if 'quantity' in request.data:
                try:
                    qty = int(request.data.get('quantity'))
                except (TypeError, ValueError):
                    return Response({'detail': 'Некорректное количество.'}, status=status.HTTP_400_BAD_REQUEST)
                if qty < 1:
                    return Response({'detail': 'Количество должно быть не меньше 1.'}, status=status.HTTP_400_BAD_REQUEST)
                item.quantity = qty
                fields.append('quantity')
            if 'comment' in request.data:
                item.comment = str(request.data.get('comment') or '').strip()[:200]
                fields.append('comment')
            if fields:
                item.save(update_fields=fields)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='item/(?P<item_id>[^/.]+)/guest')
    def set_item_guest(self, request, pk=None, item_id=None):
        try:
            guest_no = int(request.data.get('guest_no'))
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
        if guest_no < 0:
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Нельзя изменить закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                item = order.items.get(pk=item_id)
            except OrderItem.DoesNotExist:
                return Response({'detail': 'Позиция не найдена.'}, status=status.HTTP_404_NOT_FOUND)
            if item.receipt_id is not None:
                return Response({'detail': 'Позиция уже оплачена.'}, status=status.HTTP_400_BAD_REQUEST)
            item.guest_no = guest_no
            item.save(update_fields=['guest_no'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def glassware(self, request, pk=None):
        """Сколько посуды (стаканы/рюмки/бокалы) принести к столу. В чек НЕ попадает."""
        kind = request.data.get('kind')
        if kind not in dict(OrderGlassware.KIND_CHOICES):
            return Response({'detail': 'Неизвестный тип посуды.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = int(request.data.get('count'))
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректное количество.'}, status=status.HTTP_400_BAD_REQUEST)
        count = max(0, count)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Нельзя изменить закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
            if count == 0:
                OrderGlassware.objects.filter(order=order, kind=kind).delete()
            else:
                OrderGlassware.objects.update_or_create(order=order, kind=kind, defaults={'count': count})
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        """Депозит, внесённый официантом за столом (VIP без брони / оплата на месте).
        Деньги уже получены. При чекауте суммируется с депозитом брони. amount=0 — снять."""
        try:
            amount = Decimal(str(request.data.get('amount') or 0))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Некорректная сумма.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount < 0:
            return Response({'detail': 'Сумма не может быть отрицательной.'}, status=status.HTTP_400_BAD_REQUEST)
        method = request.data.get('method') or ''
        if amount > 0 and method not in dict(Order.DEPOSIT_METHODS):
            return Response({'detail': 'Укажите способ внесения депозита.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ не открыт.'}, status=status.HTTP_400_BAD_REQUEST)
            order.deposit_amount = amount
            order.deposit_method = method if amount > 0 else ''
            order.save(update_fields=['deposit_amount', 'deposit_method', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        shift = Shift.objects.filter(is_open=True).first()
        qs = Order.objects.filter(waiter=request.user)
        if shift:
            qs = qs.filter(shift=shift)
        return Response(OrderSerializer(qs, many=True).data)

    @staticmethod
    def _guest_label(order, guest_no):
        if guest_no == 0:
            return 'Общий'
        name = (order.guest_names or {}).get(str(guest_no))
        return name or f'Гость {guest_no}'

    @action(detail=True, methods=['post'], url_path='guest/rename')
    def rename_guest(self, request, pk=None):
        """Переименовать гостя (хранится в Order.guest_names: {guest_no: name})."""
        try:
            guest_no = int(request.data.get('guest_no'))
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
        if guest_no <= 0:
            return Response({'detail': 'Переименовать можно только гостя (не «Общий»).'}, status=status.HTTP_400_BAD_REQUEST)
        name = str(request.data.get('name', '')).strip()[:40]
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            names = dict(order.guest_names or {})
            if name:
                names[str(guest_no)] = name
            else:
                names.pop(str(guest_no), None)
            order.guest_names = names
            order.save(update_fields=['guest_names', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def precheck(self, request, pk=None):
        """Печать предчека (не фискального) по столу или по конкретному гостю."""
        guest_no = request.data.get('guest_no')
        order = Order.objects.get(pk=pk)
        self._check_order_access(order)
        items = list(order.items.filter(receipt__isnull=True).select_related('menu_item'))
        guest_label = ''
        if guest_no is not None and guest_no != '':
            try:
                g = int(guest_no)
            except (TypeError, ValueError):
                return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
            items = [it for it in items if it.guest_no == g]
            guest_label = self._guest_label(order, g)
        if not items:
            return Response({'detail': 'Нет позиций для предчека.'}, status=status.HTTP_400_BAD_REQUEST)

        printer = printing.get_printer_for_user(request.user)
        if printer is None:
            return Response({'detail': 'Не настроен ни один активный принтер.'}, status=status.HTTP_400_BAD_REQUEST)
        from apps.printers.models import PrintJob
        payload = printing.render_precheck(order, items, guest_label=guest_label, width=printer.width)
        job = PrintJob.objects.create(printer=printer, kind='report', payload=payload)
        printing.dispatch(job)
        return Response({'job_id': job.id, 'status': job.status, 'error': job.error},
                        status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'], url_path='guest/split')
    def split_guest(self, request, pk=None):
        """Перенести позиции гостя в новый открытый заказ (отдельный счёт)."""
        try:
            guest_no = int(request.data.get('guest_no'))
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
        table_number = str(request.data.get('table_number', '')).strip()
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ не открыт.'}, status=status.HTTP_400_BAD_REQUEST)
            items = list(order.items.filter(receipt__isnull=True, guest_no=guest_no))
            if not items:
                return Response({'detail': 'У гостя нет неоплаченных позиций.'}, status=status.HTTP_400_BAD_REQUEST)

            # Защита от гонки: целевой стол не должен быть занят другим открытым заказом.
            # Лок строки смены сериализует параллельные открытия/переносы (как в create()).
            requested = set(table_segments(table_number))
            if requested:
                Shift.objects.select_for_update().filter(pk=order.shift_id).first()
                for o in Order.objects.filter(shift=order.shift, status='open').exclude(pk=order.pk):
                    clash = requested & set(table_segments(o.table_number))
                    if clash:
                        return Response(
                            {'detail': f'Стол {", ".join(sorted(clash))} уже занят другим официантом.'},
                            status=status.HTTP_409_CONFLICT)

            new_order = Order.objects.create(
                shift=order.shift, waiter=order.waiter,
                table_number=table_number or order.table_number,
                guests=1, status='open',
            )
            OrderItem.objects.filter(pk__in=[it.pk for it in items]).update(order=new_order, guest_no=1)

            gname = (order.guest_names or {}).get(str(guest_no))
            if gname:
                new_order.guest_names = {'1': gname}
                new_order.save(update_fields=['guest_names'])
                names = dict(order.guest_names or {})
                names.pop(str(guest_no), None)
                order.guest_names = names
                order.save(update_fields=['guest_names', 'updated_at'])
        return Response({
            'order': OrderSerializer(order).data,
            'new_order': OrderSerializer(new_order).data,
        })

    @action(detail=True, methods=['post'])
    def move_table(self, request, pk=None):
        table_number = str(request.data.get('table_number', '')).strip()
        if not table_number:
            return Response({'detail': 'Укажите номер стола'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            self._check_order_access(order)
            if order.status != 'open':
                return Response({'detail': 'Заказ не открыт'}, status=status.HTTP_400_BAD_REQUEST)
            order.table_number = table_number
            order.save(update_fields=['table_number', 'updated_at'])
        return Response(OrderSerializer(order).data)


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceiptSerializer
    filterset_fields = ['shift', 'order', 'payment_method', 'waiter']
    queryset = Receipt.objects.none()  # overridden in get_queryset; required by router for basename

    def get_queryset(self):
        qs = Receipt.objects.select_related('waiter', 'waiter__profile', 'shift').prefetch_related(
            'items__menu_item__category'
        )
        if not has_perm(self.request.user, Perm.ORDER_VIEW_ALL):
            qs = qs.filter(waiter=self.request.user)
        return qs

    @action(detail=True, methods=['post'])
    def print(self, request, pk=None):
        receipt = self.get_object()
        printer = None
        printer_id = request.query_params.get('printer') or request.data.get('printer')
        if printer_id:
            printer = Printer.objects.filter(pk=printer_id, is_active=True).first()
            if printer is None:
                return Response({'detail': 'Принтер не найден или отключён.'}, status=404)
        else:
            # Маршрутизация по роли: бармен → принтер «Бар», официант → «Официанты»
            printer = printing.get_printer_for_user(request.user)
        try:
            job = printing.print_receipt(receipt, printer=printer)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'job_id': job.id, 'status': job.status, 'error': job.error},
                        status=status.HTTP_202_ACCEPTED)
