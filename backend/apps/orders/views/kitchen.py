from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Shift, OrderItem

KITCHEN_ROLES = {'kitchen', 'bartender', 'admin'}


class IsKitchenStaff(BasePermission):
    message = 'Доступно только кухне, бару и администратору.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, 'profile', None)
        if profile is None:
            return False
        roles = {profile.role, *(profile.allowed_roles or [])}
        return bool(roles & KITCHEN_ROLES)


class KitchenOrdersView(APIView):
    permission_classes = [IsKitchenStaff]

    READY_LIMIT = 15

    def get(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response({'shift': None, 'active': [], 'ready': [], 'ready_today': 0})

        category_type = request.query_params.get('type', 'kitchen')
        kitchen_items = OrderItem.objects.filter(
            order__shift=shift,
            order__status__in=['open', 'closed'],
        ).filter(
            Q(menu_item__print_station=category_type) |
            Q(menu_item__print_station='',
              menu_item__category__print_station=category_type) |
            Q(menu_item__print_station='',
              menu_item__category__print_station='',
              menu_item__category__section__station_type=category_type)
        )

        user_profile = getattr(request.user, 'profile', None)
        user_role = user_profile.role if user_profile else None

        # Bartenders see only their own kitchen orders in the kitchen tab
        if category_type == 'kitchen' and user_role == 'bartender':
            kitchen_items = kitchen_items.filter(order__waiter=request.user)

        kitchen_items = kitchen_items.select_related('order', 'order__waiter', 'order__waiter__profile', 'menu_item')

        ready_today = kitchen_items.filter(kitchen_status='ready').count()

        # Закрытые заказы, где всё готово, на экране не нужны —
        # не тянем их позиции, чтобы выборка не росла к концу смены.
        has_unready = OrderItem.objects.filter(
            order_id=OuterRef('order_id'),
        ).exclude(kitchen_status='ready')
        display_items = kitchen_items.filter(
            Q(order__status='open') | Exists(has_unready)
        )

        tickets = {}
        for it in display_items.order_by('order__created_at'):
            o = it.order
            if o.id not in tickets:
                waiter  = o.waiter
                profile = getattr(waiter, 'profile', None) if waiter else None
                elapsed = int((timezone.now() - o.created_at).total_seconds() // 60)
                waiter_role = profile.role if profile else None
                source = 'bar' if waiter_role == 'bartender' else 'table'
                tickets[o.id] = {
                    'order_id': o.id,
                    'table_number': o.table_number or '',
                    'waiter_name': (profile.get_display() if profile else
                                    (waiter.get_full_name() or waiter.username) if waiter else '—'),
                    'source': source,
                    'notes': o.notes or '',
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
    permission_classes = [IsKitchenStaff]

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
    permission_classes = [IsKitchenStaff]

    def post(self, request, order_id):
        category_type = request.query_params.get('type')
        qs = OrderItem.objects.filter(order_id=order_id)
        if category_type:
            qs = qs.filter(
                Q(menu_item__print_station=category_type) |
                Q(menu_item__print_station='',
                  menu_item__category__print_station=category_type) |
                Q(menu_item__print_station='',
                  menu_item__category__print_station='',
                  menu_item__category__section__station_type=category_type)
            )
        updated = qs.update(kitchen_status='ready')
        return Response({'order_id': int(order_id), 'updated': updated})
