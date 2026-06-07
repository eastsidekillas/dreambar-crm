from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.shifts.models import Shift
from apps.receipts.models import Receipt
from apps.printers.models import Printer
from apps.audit.models import DeletedOrderItem
from ..models import Order, OrderItem
from ..serializers import OrderSerializer, OrderCreateSerializer, OrderItemCreateSerializer, ReceiptSerializer
from apps.printers.services import printing
from apps.inventory.services import deduct_for_receipt


def _issue_receipt(order, items, payment_method, user):
    total = sum(it.subtotal for it in items)
    receipt = Receipt.objects.create(
        order=order,
        shift=order.shift,
        number=Receipt.next_number(order.shift),
        table_number=order.table_number,
        waiter=order.waiter,
        payment_method=payment_method,
        total=total,
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

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer

    def perform_create(self, serializer):
        serializer.save(waiter=self.request.user)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        order = self.get_object()
        if order.status != 'open':
            return Response({'detail': 'Заказ уже закрыт или отменён.'}, status=status.HTTP_400_BAD_REQUEST)
        unpaid = list(order.items.filter(receipt__isnull=True))
        if not unpaid:
            return Response({'detail': 'В заказе нет позиций для чека.'}, status=status.HTTP_400_BAD_REQUEST)
        payment_method = request.data.get('payment_method', 'cash')
        with transaction.atomic():
            receipt = _issue_receipt(order, unpaid, payment_method, request.user)
        return Response({
            'order': OrderSerializer(order).data,
            'receipt': ReceiptSerializer(receipt).data,
        })

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        order = self.get_object()
        if order.status != 'open':
            return Response({'detail': 'Заказ уже закрыт или отменён.'}, status=status.HTTP_400_BAD_REQUEST)

        unpaid = {it.pk: it for it in order.items.filter(receipt__isnull=True)}
        if not unpaid:
            return Response({'detail': 'Все позиции уже оплачены.'}, status=status.HTTP_400_BAD_REQUEST)

        bills = request.data.get('bills')
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

        with transaction.atomic():
            receipts = [
                _issue_receipt(order, [unpaid[i] for i in bill['item_ids']],
                               bill.get('payment_method', 'cash'), request.user)
                for bill in bills
            ]
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
            shift=shift, status='open', waiter=request.user,
        ).select_related(
            'waiter', 'waiter__profile'
        ).prefetch_related('items__menu_item__category', 'receipts__items').order_by('created_at')
        return Response(OrderSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        order.status = 'cancelled'
        order.save()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        order = self.get_object()
        if order.status != 'open':
            return Response({'detail': 'Нельзя добавить в закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = OrderItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(order=order)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['delete'], url_path='remove_item/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        order = self.get_object()
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
        order = self.get_object()
        if order.status != 'open':
            return Response({'detail': 'Нельзя изменить закрытый заказ.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            guest_no = int(request.data.get('guest_no'))
        except (TypeError, ValueError):
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
        if guest_no < 0:
            return Response({'detail': 'Некорректный номер гостя.'}, status=status.HTTP_400_BAD_REQUEST)
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


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceiptSerializer
    filterset_fields = ['shift', 'order', 'payment_method', 'waiter']
    queryset = Receipt.objects.none()  # overridden in get_queryset; required by router for basename

    def get_queryset(self):
        qs = Receipt.objects.select_related('waiter', 'waiter__profile', 'shift').prefetch_related(
            'items__menu_item__category'
        )
        if not self.request.user.is_staff:
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
        try:
            job = printing.print_receipt(receipt, printer=printer)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'job_id': job.id, 'status': job.status, 'error': job.error},
                        status=status.HTTP_202_ACCEPTED)
