from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Shift, OrderItem


class KitchenOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    READY_LIMIT = 15

    def get(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response({'shift': None, 'active': [], 'ready': [], 'ready_today': 0})

        category_type = request.query_params.get('type', 'kitchen')
        kitchen_items = OrderItem.objects.filter(
            order__shift=shift,
            order__status__in=['open', 'closed'],
            menu_item__category__type=category_type,
        ).select_related('order', 'order__waiter', 'order__waiter__profile', 'menu_item')

        ready_today = kitchen_items.filter(kitchen_status='ready').count()

        tickets = {}
        for it in kitchen_items.order_by('order__created_at'):
            o = it.order
            if o.id not in tickets:
                waiter  = o.waiter
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
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        category_type = request.query_params.get('type')
        qs = OrderItem.objects.filter(order_id=order_id)
        if category_type:
            qs = qs.filter(menu_item__category__type=category_type)
        updated = qs.update(kitchen_status='ready')
        return Response({'order_id': int(order_id), 'updated': updated})
