from datetime import date, timedelta

from django.db.models import Sum, Count, F, DecimalField
from django.db.models.functions import TruncDate, TruncMonth, ExtractHour
from django.utils.timezone import get_current_timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions_matrix import RequirePerm, Perm

from apps.orders.models import Shift, Order, OrderItem, EntryTicket, Receipt


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
            menu_item__category__section__station_type='bar'
        ).aggregate(total=Sum(F('unit_price') * F('quantity')))['total'] or 0

        kitchen_revenue = order_items.filter(
            menu_item__category__section__station_type='kitchen'
        ).aggregate(total=Sum(F('unit_price') * F('quantity')))['total'] or 0

        hookah_revenue = order_items.filter(
            menu_item__category__section__station_type='hookah'
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
                    menu_item__category__section__station_type='bar'
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0),
                'kitchen': float(shift_items.filter(
                    menu_item__category__section__station_type='kitchen'
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0),
                'hookah': float(shift_items.filter(
                    menu_item__category__section__station_type='hookah'
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
            bar = items.filter(menu_item__category__section__station_type='bar').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            kitchen = items.filter(menu_item__category__section__station_type='kitchen').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            hookah = items.filter(menu_item__category__section__station_type='hookah').aggregate(
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
            qs = qs.filter(menu_item__category__section__station_type=category_type)

        top = qs.values(
            'menu_item__id',
            'menu_item__name',
            'menu_item__category__section__station_type',
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('unit_price') * F('quantity')),
        ).order_by('-total_revenue')[:limit]

        return Response(list(top))


PAY_LABELS = {'cash': 'Наличные', 'card': 'Карта', 'transfer': 'Перевод', 'mixed': 'Смешанный'}


class ShiftDetailView(APIView):
    permission_classes = [RequirePerm(Perm.ANALYTICS_FINANCE)]

    def get(self, request, shift_id):
        from django.contrib.auth.models import User
        from apps.orders.models import DeletedOrderItem

        try:
            shift = Shift.objects.select_related('opened_by').get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Смена не найдена'}, status=404)

        paid_items = OrderItem.objects.filter(receipt__shift=shift).select_related(
            'menu_item__category', 'order'
        )
        bar_rev     = float(paid_items.filter(menu_item__category__section__station_type='bar').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        kitchen_rev = float(paid_items.filter(menu_item__category__section__station_type='kitchen').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        hookah_rev  = float(paid_items.filter(menu_item__category__section__station_type='hookah').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        ticket_rev  = float(EntryTicket.objects.filter(shift=shift).aggregate(t=Sum('price'))['t'] or 0)
        total_rev   = bar_rev + kitchen_rev + hookah_rev + ticket_rev

        receipts = list(Receipt.objects.filter(shift=shift))
        pay_totals: dict = {}
        for r in receipts:
            d = float(r.deposit_amount or 0)
            pay_totals[r.payment_method] = pay_totals.get(r.payment_method, 0) + float(r.total) - d
            if d > 0 and r.deposit_method:
                pay_totals[r.deposit_method] = pay_totals.get(r.deposit_method, 0) + d

        closed_orders = Order.objects.filter(shift=shift, status='closed')
        guests_count  = closed_orders.aggregate(t=Sum('guests'))['t'] or 0

        emp_rows = []
        for w in User.objects.filter(orders__shift=shift).distinct():
            w_rev = float(paid_items.filter(order__waiter=w).aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
            w_tickets = float(EntryTicket.objects.filter(shift=shift, created_by=w).aggregate(
                t=Sum('price'))['t'] or 0)
            profile = getattr(w, 'profile', None)
            emp_rows.append({
                'user_id': w.id,
                'display_name': profile.get_display() if profile else w.get_full_name() or w.username,
                'orders_count': closed_orders.filter(waiter=w).count(),
                'revenue': w_rev + w_tickets,
            })
        emp_rows.sort(key=lambda x: -x['revenue'])

        top_raw = paid_items.values(
            'menu_item__name', 'menu_item__volume', 'menu_item__category__section__station_type'
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('unit_price') * F('quantity')),
        ).order_by('-total_revenue')[:10]

        deletions      = list(DeletedOrderItem.objects.filter(shift=shift))
        deleted_count  = len(deletions)
        deleted_amount = float(sum(d.unit_price * d.quantity for d in deletions))

        return Response({
            'shift_id':   shift.id,
            'date':       shift.date,
            'is_open':    shift.is_open,
            'opened_by':  (shift.opened_by.get_full_name() or shift.opened_by.username) if shift.opened_by else None,
            'opened_at':  shift.opened_at,
            'closed_at':  shift.closed_at,
            'by_category': {'bar': bar_rev, 'kitchen': kitchen_rev, 'hookah': hookah_rev, 'tickets': ticket_rev},
            'by_payment': [
                {'method': m, 'label': PAY_LABELS.get(m, m), 'amount': a}
                for m, a in sorted(pay_totals.items(), key=lambda x: -x[1])
            ],
            'summary': {
                'total_revenue':  total_rev,
                'orders_count':   closed_orders.count(),
                'receipts_count': len(receipts),
                'guests_count':   int(guests_count),
                'avg_check':      round(total_rev / len(receipts)) if receipts else 0,
                'deleted_count':  deleted_count,
                'deleted_amount': deleted_amount,
            },
            'employees': emp_rows,
            'top_items': [
                {
                    'name':    t['menu_item__name'],
                    'volume':  t['menu_item__volume'] or '',
                    'type':    t['menu_item__category__section__station_type'],
                    'qty':     t['total_qty'],
                    'revenue': float(t['total_revenue']),
                }
                for t in top_raw
            ],
        })


class SalesReportView(APIView):
    permission_classes = [RequirePerm(Perm.ANALYTICS_FINANCE)]

    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        shifts = Shift.objects.all()
        if date_from:
            shifts = shifts.filter(date__gte=date_from)
        if date_to:
            shifts = shifts.filter(date__lte=date_to)

        paid_items = OrderItem.objects.filter(receipt__shift__in=shifts).select_related(
            'menu_item__category', 'menu_item'
        )
        bar_rev     = float(paid_items.filter(menu_item__category__section__station_type='bar').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        kitchen_rev = float(paid_items.filter(menu_item__category__section__station_type='kitchen').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        hookah_rev  = float(paid_items.filter(menu_item__category__section__station_type='hookah').aggregate(
            t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
        ticket_rev  = float(EntryTicket.objects.filter(shift__in=shifts).aggregate(t=Sum('price'))['t'] or 0)
        total_rev   = bar_rev + kitchen_rev + hookah_rev + ticket_rev

        total_cogs = float(paid_items.aggregate(
            t=Sum(F('menu_item__cost_price') * F('quantity')))['t'] or 0)
        gross_profit = total_rev - total_cogs

        receipts = Receipt.objects.filter(shift__in=shifts)
        receipts_count = receipts.count()
        pay_map: dict = {}
        for r in receipts:
            d = float(r.deposit_amount or 0)
            pay_map[r.payment_method] = pay_map.get(r.payment_method, 0) + float(r.total) - d
            if d > 0 and r.deposit_method:
                pay_map[r.deposit_method] = pay_map.get(r.deposit_method, 0) + d
        pay_data = [{'payment_method': m, 'total': t} for m, t in sorted(pay_map.items(), key=lambda x: -x[1])]

        orders = Order.objects.filter(shift__in=shifts, status='closed')
        guests = int(orders.aggregate(t=Sum('guests'))['t'] or 0)

        from apps.orders.models import DeletedOrderItem
        deletions      = list(DeletedOrderItem.objects.filter(shift__in=shifts))
        deleted_count  = len(deletions)
        deleted_amount = float(sum(d.unit_price * d.quantity for d in deletions))

        top_raw = list(paid_items.values(
            'menu_item__id', 'menu_item__name', 'menu_item__volume',
            'menu_item__category__section__station_type', 'menu_item__cost_price',
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum(F('unit_price') * F('quantity')),
            total_cost=Sum(F('menu_item__cost_price') * F('quantity')),
        ).order_by('-total_revenue')[:20])

        shifts_list = []
        for s in shifts.order_by('-date'):
            s_items  = paid_items.filter(receipt__shift=s)
            s_rev    = float(s_items.aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0)
            s_tickets= float(EntryTicket.objects.filter(shift=s).aggregate(t=Sum('price'))['t'] or 0)
            shifts_list.append({
                'shift_id':      s.id,
                'date':          s.date,
                'is_open':       s.is_open,
                'revenue':       s_rev + s_tickets,
                'orders_count':  Order.objects.filter(shift=s, status='closed').count(),
                'receipts_count':Receipt.objects.filter(shift=s).count(),
            })

        return Response({
            'summary': {
                'total_revenue':  total_rev,
                'total_cogs':     total_cogs,
                'gross_profit':   gross_profit,
                'gross_margin':   round(gross_profit / total_rev * 100, 1) if total_rev else 0,
                'orders_count':   orders.count(),
                'receipts_count': receipts_count,
                'guests_count':   guests,
                'avg_check':      round(total_rev / receipts_count) if receipts_count else 0,
                'deleted_count':  deleted_count,
                'deleted_amount': deleted_amount,
            },
            'by_category': {'bar': bar_rev, 'kitchen': kitchen_rev, 'hookah': hookah_rev, 'tickets': ticket_rev},
            'by_payment': [
                {'method': r['payment_method'], 'label': PAY_LABELS.get(r['payment_method'], r['payment_method']), 'amount': float(r['total'])}
                for r in pay_data
            ],
            'top_items': [
                {
                    'id':      t['menu_item__id'],
                    'name':    t['menu_item__name'],
                    'volume':  t['menu_item__volume'] or '',
                    'type':    t['menu_item__category__section__station_type'],
                    'qty':     t['total_qty'],
                    'revenue': float(t['total_revenue']),
                    'cost':    float(t['total_cost'] or 0),
                    'profit':  float((t['total_revenue'] or 0) - (t['total_cost'] or 0)),
                }
                for t in top_raw
            ],
            'by_shift': shifts_list,
        })


class ForecastView(APIView):
    permission_classes = [RequirePerm(Perm.ANALYTICS_FINANCE)]

    WEEKDAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

    def get(self, request):
        today = date.today()
        tz = get_current_timezone()

        # Group all past closed shifts by weekday
        all_past = list(Shift.objects.filter(date__lt=today, is_open=False))
        by_weekday: dict[int, list] = {}
        for s in all_past:
            by_weekday.setdefault(s.date.weekday(), []).append(s)

        result = []
        for delta in range(1, 8):
            day = today + timedelta(days=delta)
            wd = day.weekday()
            shifts = by_weekday.get(wd, [])
            n = len(shifts)

            if not n:
                result.append({
                    'date': day.isoformat(),
                    'weekday': wd,
                    'weekday_name': self.WEEKDAY_NAMES[wd],
                    'samples': 0,
                    'revenue': 0,
                    'receipts_count': 0,
                    'avg_check': 0,
                    'by_category': {'bar': 0, 'kitchen': 0, 'hookah': 0, 'tickets': 0},
                    'by_hour': [],
                })
                continue

            shift_ids = [s.id for s in shifts]
            items = OrderItem.objects.filter(order__shift_id__in=shift_ids, order__status='closed')

            def cat_rev(station):
                return float(items.filter(
                    menu_item__category__section__station_type=station
                ).aggregate(t=Sum(F('unit_price') * F('quantity')))['t'] or 0)

            bar_t     = cat_rev('bar')
            kitchen_t = cat_rev('kitchen')
            hookah_t  = cat_rev('hookah')
            ticket_t  = float(EntryTicket.objects.filter(shift_id__in=shift_ids).aggregate(t=Sum('price'))['t'] or 0)
            total_rev = bar_t + kitchen_t + hookah_t + ticket_t
            rec_count = Receipt.objects.filter(shift_id__in=shift_ids).count()

            hours_raw = (
                Receipt.objects.filter(shift_id__in=shift_ids)
                .annotate(hour=ExtractHour('issued_at', tzinfo=tz))
                .values('hour')
                .annotate(total_revenue=Sum('total'), cnt=Count('id'))
                .order_by('hour')
            )

            result.append({
                'date': day.isoformat(),
                'weekday': wd,
                'weekday_name': self.WEEKDAY_NAMES[wd],
                'samples': n,
                'revenue': round(total_rev / n),
                'receipts_count': round(rec_count / n),
                'avg_check': round(total_rev / rec_count) if rec_count else 0,
                'by_category': {
                    'bar':     round(bar_t / n),
                    'kitchen': round(kitchen_t / n),
                    'hookah':  round(hookah_t / n),
                    'tickets': round(ticket_t / n),
                },
                'by_hour': [
                    {
                        'hour': h['hour'],
                        'revenue': round(float(h['total_revenue']) / n),
                        'receipts': round(h['cnt'] / n, 1),
                    }
                    for h in hours_raw
                ],
            })

        return Response(result)


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
        ).values('month', 'menu_item__category__section__station_type').annotate(
            revenue=Sum(F('unit_price') * F('quantity'))
        ).order_by('month')

        months = {}
        for row in tickets_by_month:
            key = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            months.setdefault(key, {'bar': 0, 'kitchen': 0, 'hookah': 0, 'tickets': 0})
            months[key]['tickets'] += float(row['revenue'] or 0)

        for row in items_by_month:
            key = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            cat = row['menu_item__category__section__station_type']
            months.setdefault(key, {'bar': 0, 'kitchen': 0, 'hookah': 0, 'tickets': 0})
            if cat in months[key]:
                months[key][cat] += float(row['revenue'] or 0)

        result = [
            {'month': k, **v, 'total': sum(v.values())}
            for k, v in sorted(months.items())
        ]
        return Response(result)
