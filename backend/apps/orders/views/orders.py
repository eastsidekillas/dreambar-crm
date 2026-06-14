from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.shifts.models import Shift
from apps.receipts.models import Receipt
from apps.printers.models import Printer
from apps.audit.models import DeletedOrderItem
from apps.users.permissions_matrix import HasPerm, Perm, has_perm
from ..models import Order, OrderItem
from ..serializers import OrderSerializer, OrderCreateSerializer, OrderItemCreateSerializer, ReceiptSerializer
from apps.printers.services import printing
from apps.inventory.services import deduct_for_receipt


def _issue_receipt(order, items, payment_method, user, deposit_amount=Decimal(0), deposit_method=''):
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
    )
    OrderItem.objects.filter(pk__in=[it.pk for it in items]).update(receipt=receipt)
    deduct_for_receipt(items, receipt, user=user)

    if not order.items.filter(receipt__isnull=True).exists():
        order.status = 'closed'
        order.closed_at = timezone.now()
        order.save(update_fields=['status', 'closed_at', 'updated_at'])
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
        deposit_amount = Decimal(str(request.data.get('deposit_amount') or 0))
        deposit_method = request.data.get('deposit_method', '')
        if deposit_amount < 0:
            return Response({'detail': 'deposit_amount не может быть отрицательным.'}, status=status.HTTP_400_BAD_REQUEST)
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

            receipts = []
            for idx, bill in enumerate(bills):
                d_amt = deposit_amount if idx == 0 else Decimal(0)
                d_mth = deposit_method if idx == 0 else ''
                receipts.append(
                    _issue_receipt(order, [unpaid[i] for i in bill['item_ids']],
                                   bill.get('payment_method', 'cash'), request.user,
                                   deposit_amount=d_amt, deposit_method=d_mth)
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
            serializer.save(order=order)
        return Response(OrderSerializer(order).data)

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

    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        shift = Shift.objects.filter(is_open=True).first()
        qs = Order.objects.filter(waiter=request.user)
        if shift:
            qs = qs.filter(shift=shift)
        return Response(OrderSerializer(qs, many=True).data)

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
