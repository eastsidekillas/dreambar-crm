from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Sum, Count, F
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView

from .models import Shift, MenuCategory, MenuItem, Order, OrderItem, EntryTicket, UserProfile, Receipt
from .serializers import (
    ShiftSerializer, MenuCategorySerializer, MenuItemSerializer,
    MenuItemWriteSerializer, OrderSerializer, OrderCreateSerializer,
    OrderItemSerializer, OrderItemCreateSerializer, EntryTicketSerializer,
    ReceiptSerializer,
)


def _issue_receipt(order, items, payment_method, user):
    """Сформировать один чек по заказу для переданных позиций.

    Привязывает позиции к чеку, фиксирует сумму. Если после этого в заказе не
    осталось неоплаченных позиций — закрывает заказ (стол освобождается).
    Возвращает созданный объект Receipt.
    """
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

    if not order.items.filter(receipt__isnull=True).exists():
        order.status = 'closed'
        order.closed_at = timezone.now()
        order.save(update_fields=['status', 'closed_at', 'updated_at'])
    return receipt


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

    def perform_create(self, serializer):
        serializer.save(opened_by=self.request.user)

    @action(detail=False, methods=['get'])
    def current(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response({'detail': 'Нет открытой смены.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        shift = self.get_object()
        if not shift.is_open:
            return Response({'detail': 'Смена уже закрыта.'}, status=status.HTTP_400_BAD_REQUEST)
        shift.is_open = False
        shift.closed_at = timezone.now()
        shift.save()
        return Response(ShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        shift = self.get_object()
        shift.is_open = True
        shift.closed_at = None
        shift.save()
        return Response(ShiftSerializer(shift).data)


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset = MenuCategory.objects.all()
    serializer_class = MenuCategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related('category').filter(is_active=True)
    filterset_fields = ['category', 'category__type', 'is_active']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemWriteSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = MenuItem.objects.select_related('category')
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        categories = MenuCategory.objects.prefetch_related('items').all()
        result = []
        for cat in categories:
            items = cat.items.filter(is_active=True)
            result.append({
                'id': cat.id,
                'name': cat.name,
                'type': cat.type,
                'items': MenuItemSerializer(items, many=True).data,
            })
        return Response(result)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('waiter', 'shift').prefetch_related('items__menu_item__category')
    filterset_fields = ['shift', 'status', 'waiter']

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer

    def perform_create(self, serializer):
        serializer.save(waiter=self.request.user)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Закрыть заказ одним чеком на все неоплаченные позиции."""
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
        """Сформировать чек(и) по заказу.

        Тело запроса:
          - `payment_method`: способ оплаты (для одиночного чека);
          - `item_ids`: подмножество позиций для раздельного счёта (один чек);
          - `bills`: список вида [{item_ids:[...], payment_method:'cash'}, ...]
            для разбивки счёта на несколько чеков сразу.
        Если ничего не передано — чек на все неоплаченные позиции.
        """
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

        # Валидация: позиции существуют, не оплачены и не пересекаются между чеками.
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
                _issue_receipt(
                    order,
                    [unpaid[i] for i in bill['item_ids']],
                    bill.get('payment_method', 'cash'),
                    request.user,
                )
                for bill in bills
            ]
        return Response({
            'order': OrderSerializer(order).data,
            'receipts': ReceiptSerializer(receipts, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Открытые посадки текущей смены — занятые столы."""
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response([])
        qs = Order.objects.filter(shift=shift, status='open').select_related(
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
            item.delete()
        except OrderItem.DoesNotExist:
            return Response({'detail': 'Позиция не найдена.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        shift = Shift.objects.filter(is_open=True).first()
        qs = Order.objects.filter(waiter=request.user)
        if shift:
            qs = qs.filter(shift=shift)
        return Response(OrderSerializer(qs, many=True).data)


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """Просмотр и повторная печать чеков."""
    queryset = Receipt.objects.select_related('waiter', 'waiter__profile', 'shift').prefetch_related(
        'items__menu_item__category'
    )
    serializer_class = ReceiptSerializer
    filterset_fields = ['shift', 'order', 'payment_method']


class EntryTicketViewSet(viewsets.ModelViewSet):
    queryset = EntryTicket.objects.select_related('created_by', 'shift')
    serializer_class = EntryTicketSerializer
    filterset_fields = ['shift']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple tickets: from-to bracelet range."""
        shift_id = request.data.get('shift')
        start = request.data.get('start')
        end = request.data.get('end')
        price = request.data.get('price', 200)

        if not all([shift_id, start, end]):
            return Response({'detail': 'Укажите shift, start, end.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_n, end_n = int(start), int(end)
            shift = Shift.objects.get(pk=shift_id)
        except (ValueError, Shift.DoesNotExist):
            return Response({'detail': 'Некорректные данные.'}, status=status.HTTP_400_BAD_REQUEST)

        tickets = [
            EntryTicket(
                shift=shift,
                bracelet_number=str(i).zfill(6),
                price=price,
                created_by=request.user,
            )
            for i in range(start_n, end_n + 1)
        ]
        created = EntryTicket.objects.bulk_create(tickets, ignore_conflicts=True)
        return Response({'created': len(created)}, status=status.HTTP_201_CREATED)


class EmployeeActivityView(APIView):
    """Admin: activity of all employees per shift."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shift_id = request.query_params.get('shift')
        shifts = Shift.objects.filter(pk=shift_id) if shift_id else Shift.objects.all()

        employees = User.objects.prefetch_related('profile').filter(
            Q(orders__shift__in=shifts) | Q(entryticket__shift__in=shifts)
        ).distinct()

        result = []
        for emp in employees:
            profile = getattr(emp, 'profile', None)
            emp_orders = Order.objects.filter(waiter=emp, shift__in=shifts, status='closed')
            emp_tickets = EntryTicket.objects.filter(created_by=emp, shift__in=shifts)

            order_items = OrderItem.objects.filter(order__in=emp_orders)
            bar_rev = order_items.filter(menu_item__category__type='bar').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            kitchen_rev = order_items.filter(menu_item__category__type='kitchen').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            hookah_rev = order_items.filter(menu_item__category__type='hookah').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            ticket_rev = emp_tickets.aggregate(t=Sum('price'))['t'] or 0

            result.append({
                'user_id': emp.id,
                'username': emp.username,
                'display_name': profile.get_display() if profile else emp.get_full_name() or emp.username,
                'role': profile.role if profile else 'waiter',
                'role_label': profile.get_role_display() if profile else 'Официант',
                'orders_count': emp_orders.count(),
                'tickets_count': emp_tickets.count(),
                'bar_revenue': float(bar_rev),
                'kitchen_revenue': float(kitchen_rev),
                'hookah_revenue': float(hookah_rev),
                'ticket_revenue': float(ticket_rev),
                'total_revenue': float(bar_rev + kitchen_rev + hookah_rev + ticket_rev),
            })

        result.sort(key=lambda x: -x['total_revenue'])
        return Response(result)


class EmployeeOrdersView(APIView):
    """Admin: all orders of a specific employee."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        shift_id = request.query_params.get('shift')
        qs = Order.objects.select_related('waiter', 'shift').prefetch_related(
            'items__menu_item__category'
        ).filter(status='closed')
        if user_id:
            qs = qs.filter(waiter_id=user_id)
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        from .serializers import OrderSerializer
        return Response(OrderSerializer(qs, many=True).data)


class UserProfileListView(APIView):
    """List all employees with their profiles."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.prefetch_related('profile').all().order_by('username')
        result = []
        for u in users:
            profile = getattr(u, 'profile', None)
            result.append({
                'id': u.id,
                'username': u.username,
                'display_name': profile.get_display() if profile else u.get_full_name() or u.username,
                'role': profile.role if profile else ('admin' if u.is_staff else 'waiter'),
                'role_label': profile.get_role_display() if profile else 'Официант',
                'is_active': u.is_active,
            })
        return Response(result)

    def post(self, request):
        """Create employee or update role."""
        username = request.data.get('username')
        password = request.data.get('password', 'dreambar2026')
        role = request.data.get('role', 'waiter')
        display_name = request.data.get('display_name', '')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if not username:
            return Response({'detail': 'username обязателен'}, status=400)

        user, created = User.objects.get_or_create(username=username, defaults={
            'first_name': first_name, 'last_name': last_name,
            'is_staff': role == 'admin',
        })
        if created:
            user.set_password(password)
            user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.display_name = display_name
        profile.save()

        return Response({
            'id': user.id, 'username': user.username,
            'display_name': profile.get_display(), 'role': role,
            'created': created,
        }, status=201 if created else 200)


# ── Kitchen Display System ───────────────────────────────────────────────────

class KitchenOrdersView(APIView):
    """Kitchen tickets for the open shift, split into active (has unfinished
    items) and ready (all kitchen items done). Returns only kitchen items."""
    permission_classes = [IsAuthenticated]

    READY_LIMIT = 15

    def get(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response({'shift': None, 'active': [], 'ready': [], 'ready_today': 0})

        kitchen_items = OrderItem.objects.filter(
            order__shift=shift,
            order__status__in=['open', 'closed'],
            menu_item__category__type='kitchen',
        ).select_related('order', 'order__waiter', 'order__waiter__profile', 'menu_item')

        ready_today = kitchen_items.filter(kitchen_status='ready').count()

        # Group ALL kitchen items by order (so cook sees full progress)
        tickets = {}
        for it in kitchen_items.order_by('order__created_at'):
            o = it.order
            if o.id not in tickets:
                waiter = o.waiter
                profile = getattr(waiter, 'profile', None) if waiter else None
                elapsed = int((timezone.now() - o.created_at).total_seconds() // 60)
                tickets[o.id] = {
                    'order_id': o.id,
                    'table_number': o.table_number or '',
                    'waiter_name': (profile.get_display() if profile else
                                    (waiter.get_full_name() or waiter.username) if waiter else '—'),
                    'created_at': o.created_at,
                    'elapsed_min': elapsed,
                    'items': [],
                    '_all_ready': True,
                }
            t = tickets[o.id]
            t['items'].append({
                'id': it.id,
                'name': it.menu_item.name,
                'volume': it.menu_item.volume,
                'quantity': it.quantity,
                'kitchen_status': it.kitchen_status,
            })
            if it.kitchen_status != 'ready':
                t['_all_ready'] = False

        active, ready = [], []
        for t in tickets.values():
            done = t.pop('_all_ready')
            (ready if done else active).append(t)

        # active: oldest first (most urgent); ready: newest first, limited
        active.sort(key=lambda t: t['created_at'])
        ready.sort(key=lambda t: t['created_at'], reverse=True)
        ready = ready[:self.READY_LIMIT]

        return Response({
            'shift': shift.id,
            'date': shift.date,
            'active': active,
            'ready': ready,
            'ready_today': ready_today,
        })


class KitchenItemStatusView(APIView):
    """Update a single kitchen item's prep status."""
    permission_classes = [IsAuthenticated]

    def post(self, request, item_id):
        new_status = request.data.get('status')
        if new_status not in ('new', 'cooking', 'ready'):
            return Response({'detail': 'Некорректный статус.'}, status=400)
        try:
            item = OrderItem.objects.get(pk=item_id)
        except OrderItem.DoesNotExist:
            return Response({'detail': 'Позиция не найдена.'}, status=404)
        item.kitchen_status = new_status
        item.save(update_fields=['kitchen_status'])
        return Response({'id': item.id, 'kitchen_status': item.kitchen_status})


class KitchenOrderReadyView(APIView):
    """Mark all kitchen items of an order as ready (whole ticket done)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        items = OrderItem.objects.filter(order_id=order_id, menu_item__category__type='kitchen')
        if not items.exists():
            return Response({'detail': 'Нет блюд кухни в заказе.'}, status=404)
        items.update(kitchen_status='ready')
        return Response({'order_id': int(order_id), 'updated': items.count()})
