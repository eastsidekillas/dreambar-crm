from django.db.models import Sum, Count, Avg, F, DecimalField
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.orders.models import Shift, Order, OrderItem, EntryTicket


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Last 30 days stats
        from django.utils import timezone
        from datetime import timedelta
        since = timezone.now() - timedelta(days=30)

        shifts = Shift.objects.filter(date__gte=since.date())

        ticket_revenue = EntryTicket.objects.filter(
            shift__in=shifts
        ).aggregate(total=Sum('price'))['total'] or 0

        order_items = OrderItem.objects.filter(
            order__shift__in=shifts,
            order__status='closed'
        )

        bar_revenue = order_items.filter(
            menu_item__category__type='bar'
        ).aggregate(total=Sum(F('unit_price') * F('quantity')))['total'] or 0

        kitchen_revenue = order_items.filter(
            menu_item__category__type='kitchen'
        ).aggregate(total=Sum(F('unit_price') * F('quantity')))['total'] or 0

        hookah_revenue = order_items.filter(
            menu_item__category__type='hookah'
        ).aggregate(total=Sum(F('unit_price') * F('quantity')))['total'] or 0

        total_orders = Order.objects.filter(
            shift__in=shifts, status='closed'
        ).count()

        total_guests = Order.objects.filter(
            shift__in=shifts, status='closed'
        ).aggregate(total=Sum('guests'))['total'] or 0

        total_tickets = EntryTicket.objects.filter(shift__in=shifts).count()

        # Current open shift
        open_shift = Shift.objects.filter(is_open=True).first()
        open_shift_data = None
        if open_shift:
            shift_items = OrderItem.objects.filter(
                order__shift=open_shift, order__status='closed'
            )
            open_shift_data = {
                'id': open_shift.id,
                'date': open_shift.date,
                'bar': float(shift_items.filter(
                    menu_item__category__type='bar'
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0),
                'kitchen': float(shift_items.filter(
                    menu_item__category__type='kitchen'
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0),
                'hookah': float(shift_items.filter(
                    menu_item__category__type='hookah'
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0),
                'tickets': float(open_shift.entry_tickets.aggregate(
                    t=Sum('price'))['t'] or 0),
                'orders_count': open_shift.orders.filter(status='closed').count(),
                'tickets_count': open_shift.entry_tickets.count(),
            }

        return Response({
            'period_days': 30,
            'total_revenue': float(bar_revenue + kitchen_revenue + hookah_revenue + ticket_revenue),
            'by_category': {
                'bar': float(bar_revenue),
                'kitchen': float(kitchen_revenue),
                'hookah': float(hookah_revenue),
                'tickets': float(ticket_revenue),
            },
            'total_orders': total_orders,
            'total_guests': total_guests,
            'total_tickets': total_tickets,
            'shifts_count': shifts.count(),
            'current_shift': open_shift_data,
        })


class ShiftAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        shifts = Shift.objects.order_by('-date')[:limit]

        result = []
        for shift in shifts:
            items = OrderItem.objects.filter(
                order__shift=shift, order__status='closed'
            )
            bar = items.filter(menu_item__category__type='bar').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            kitchen = items.filter(menu_item__category__type='kitchen').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            hookah = items.filter(menu_item__category__type='hookah').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            tickets = shift.entry_tickets.aggregate(t=Sum('price'))['t'] or 0

            result.append({
                'shift_id': shift.id,
                'date': shift.date,
                'is_open': shift.is_open,
                'bar': float(bar),
                'kitchen': float(kitchen),
                'hookah': float(hookah),
                'tickets': float(tickets),
                'total': float(bar + kitchen + hookah + tickets),
                'orders_count': shift.orders.filter(status='closed').count(),
                'tickets_count': shift.entry_tickets.count(),
            })

        return Response(result)


class TopItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category_type = request.query_params.get('type')
        limit = int(request.query_params.get('limit', 10))

        qs = OrderItem.objects.filter(order__status='closed').select_related(
            'menu_item__category'
        )
        if category_type:
            qs = qs.filter(menu_item__category__type=category_type)

        top = qs.values(
            'menu_item__id',
            'menu_item__name',
            'menu_item__category__type',
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('unit_price') * F('quantity')),
        ).order_by('-total_revenue')[:limit]

        return Response(list(top))


class MonthlyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tickets_by_month = EntryTicket.objects.annotate(
            month=TruncMonth('sold_at')
        ).values('month').annotate(revenue=Sum('price')).order_by('month')

        items_by_month = OrderItem.objects.filter(
            order__status='closed'
        ).annotate(
            month=TruncMonth('order__created_at')
        ).values('month', 'menu_item__category__type').annotate(
            revenue=Sum(F('unit_price') * F('quantity'))
        ).order_by('month')

        months = {}
        for row in tickets_by_month:
            key = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            months.setdefault(key, {'bar': 0, 'kitchen': 0, 'hookah': 0, 'tickets': 0})
            months[key]['tickets'] += float(row['revenue'] or 0)

        for row in items_by_month:
            key = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            cat = row['menu_item__category__type']
            months.setdefault(key, {'bar': 0, 'kitchen': 0, 'hookah': 0, 'tickets': 0})
            if cat in months[key]:
                months[key][cat] += float(row['revenue'] or 0)

        result = [
            {'month': k, **v, 'total': sum(v.values())}
            for k, v in sorted(months.items())
        ]
        return Response(result)
