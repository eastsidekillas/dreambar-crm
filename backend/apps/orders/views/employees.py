from django.contrib.auth.models import User
from django.db.models import Q, Sum, F
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Order, OrderItem, EntryTicket, UserProfile, Shift
from ..serializers import OrderSerializer


class UserProfileListView(APIView):
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
                'allowed_roles': profile.allowed_roles if profile else [],
                'is_active': u.is_active,
            })
        return Response(result)

    def post(self, request):
        username     = request.data.get('username')
        password     = request.data.get('password', 'dreambar2026')
        role         = request.data.get('role', 'waiter')
        display_name = request.data.get('display_name', '')
        first_name   = request.data.get('first_name', '')
        last_name    = request.data.get('last_name', '')

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


class EmployeeActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shift_id = request.query_params.get('shift')
        shifts   = Shift.objects.filter(pk=shift_id) if shift_id else Shift.objects.all()

        employees = User.objects.prefetch_related('profile').filter(
            Q(orders__shift__in=shifts) | Q(entryticket__shift__in=shifts)
        ).distinct()

        result = []
        for emp in employees:
            profile     = getattr(emp, 'profile', None)
            emp_orders  = Order.objects.filter(waiter=emp, shift__in=shifts, status='closed')
            emp_tickets = EntryTicket.objects.filter(created_by=emp, shift__in=shifts)

            order_items = OrderItem.objects.filter(order__in=emp_orders)
            bar_rev     = order_items.filter(menu_item__category__type='bar').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            kitchen_rev = order_items.filter(menu_item__category__type='kitchen').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            hookah_rev  = order_items.filter(menu_item__category__type='hookah').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            ticket_rev  = emp_tickets.aggregate(t=Sum('price'))['t'] or 0

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


class EmployeeDetailView(APIView):
    """PATCH /employees/<id>/ — редактировать роль, имя, пароль, статус."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден.'}, status=404)

        if any(k in request.data for k in ('display_name', 'role', 'allowed_roles')):
            profile, _ = UserProfile.objects.get_or_create(user=user)
            if 'display_name' in request.data:
                profile.display_name = request.data['display_name']
            if 'role' in request.data:
                profile.role = request.data['role']
                user.is_staff = request.data['role'] == 'admin'
                user.save(update_fields=['is_staff'])
            if 'allowed_roles' in request.data:
                profile.allowed_roles = request.data['allowed_roles']
            profile.save()

        if 'password' in request.data and request.data['password']:
            user.set_password(request.data['password'])
            user.save(update_fields=['password'])

        if 'is_active' in request.data:
            user.is_active = bool(request.data['is_active'])
            user.save(update_fields=['is_active'])

        profile = getattr(user, 'profile', None)
        return Response({
            'id': user.id,
            'username': user.username,
            'display_name': profile.get_display() if profile else user.get_full_name() or user.username,
            'role': profile.role if profile else 'waiter',
            'allowed_roles': profile.allowed_roles if profile else [],
            'is_active': user.is_active,
        })


class EmployeeOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id  = request.query_params.get('user_id')
        shift_id = request.query_params.get('shift')
        qs = Order.objects.select_related('waiter', 'shift').prefetch_related(
            'items__menu_item__category'
        ).filter(status='closed')
        if user_id:
            qs = qs.filter(waiter_id=user_id)
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        return Response(OrderSerializer(qs, many=True).data)
