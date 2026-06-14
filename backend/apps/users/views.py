from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from django.db.models import Q, Sum, F
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.users.permissions_matrix import RequirePerm, Perm, has_perm
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile
from apps.orders.models import Order, OrderItem, EntryTicket, Shift, DeletedOrderItem
from apps.orders.serializers import OrderSerializer


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
                'has_pin': bool(profile.pin_hash) if profile else False,
                'must_change_password': profile.must_change_password if profile else False,
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
        if created:
            # Пароль выдан админом — временный, при первом входе сотрудник сменит его
            profile.must_change_password = True
        profile.save()

        return Response({
            'id': user.id, 'username': user.username,
            'display_name': profile.get_display(), 'role': role,
            'created': created,
        }, status=201 if created else 200)


class EmployeeDetailView(APIView):
    """PATCH /employees/<id>/ — редактировать роль, имя, пароль, статус."""
    permission_classes = [RequirePerm(Perm.EMPLOYEE_MANAGE)]

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
            # Сброс пароля админом — снова временный
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.must_change_password = True
            profile.save(update_fields=['must_change_password'])

        if 'pin' in request.data:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            pin = str(request.data['pin']).strip()
            profile.pin_hash = make_password(pin) if pin else ''
            profile.save(update_fields=['pin_hash'])

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
            'has_pin': bool(profile.pin_hash) if profile else False,
            'must_change_password': profile.must_change_password if profile else False,
        })

    def delete(self, request, user_id):
        if not has_perm(request.user, Perm.EMPLOYEE_MANAGE):
            return Response({'detail': 'Недостаточно прав.'}, status=403)
        if request.user.id == user_id:
            return Response({'detail': 'Нельзя удалить себя.'}, status=400)
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден.'}, status=404)
        user.delete()
        return Response(status=204)


class EmployeeActivityView(APIView):
    permission_classes = [RequirePerm(Perm.EMPLOYEE_MANAGE)]

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
            bar_rev     = order_items.filter(menu_item__category__section__station_type='bar').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            kitchen_rev = order_items.filter(menu_item__category__section__station_type='kitchen').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            hookah_rev  = order_items.filter(menu_item__category__section__station_type='hookah').aggregate(
                t=Sum(F('unit_price') * F('quantity')))['t'] or 0
            ticket_rev  = emp_tickets.aggregate(t=Sum('price'))['t'] or 0
            total_rev   = bar_rev + kitchen_rev + hookah_rev + ticket_rev

            orders_count = emp_orders.count()
            total_guests = emp_orders.aggregate(t=Sum('guests'))['t'] or 0

            deletions      = DeletedOrderItem.objects.filter(deleted_by=emp, shift__in=shifts)
            deleted_count  = deletions.count()
            deleted_amount = float(sum(d.unit_price * d.quantity for d in deletions)) if deleted_count else 0

            result.append({
                'user_id': emp.id,
                'username': emp.username,
                'display_name': profile.get_display() if profile else emp.get_full_name() or emp.username,
                'role': profile.role if profile else 'waiter',
                'role_label': profile.get_role_display() if profile else 'Официант',
                'orders_count': orders_count,
                'tickets_count': emp_tickets.count(),
                'bar_revenue': float(bar_rev),
                'kitchen_revenue': float(kitchen_rev),
                'hookah_revenue': float(hookah_rev),
                'ticket_revenue': float(ticket_rev),
                'total_revenue': float(total_rev),
                'avg_check': round(float(total_rev) / orders_count) if orders_count else 0,
                'total_guests': total_guests,
                'deleted_count': deleted_count,
                'deleted_amount': deleted_amount,
            })

        result.sort(key=lambda x: -x['total_revenue'])
        return Response(result)


class EmployeeOrdersView(APIView):
    permission_classes = [RequirePerm(Perm.EMPLOYEE_MANAGE)]

    def get(self, request):
        user_id  = request.query_params.get('user_id')
        shift_id = request.query_params.get('shift')
        qs = Order.objects.select_related('waiter', 'shift').prefetch_related(
            'items__menu_item__category__section'
        ).filter(status='closed')
        if user_id:
            qs = qs.filter(waiter_id=user_id)
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        return Response(OrderSerializer(qs, many=True).data)


class StaffListView(APIView):
    """Публичный список сотрудников для экрана PIN-входа."""
    permission_classes = [AllowAny]

    def get(self, request):
        users = User.objects.select_related('profile').filter(is_active=True).order_by('profile__display_name')
        result = []
        for u in users:
            profile = getattr(u, 'profile', None)
            if not profile:
                continue
            result.append({
                'id':           u.id,
                'display_name': profile.get_display(),
                'role':         profile.role,
                'role_label':   profile.get_role_display(),
                'has_pin':      bool(profile.pin_hash),
            })
        return Response(result)


class MyPasswordView(APIView):
    """POST {current_password, new_password} — смена собственного пароля.
    Сбрасывает флаг must_change_password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = str(request.data.get('current_password', ''))
        new     = str(request.data.get('new_password', ''))

        if not request.user.check_password(current):
            return Response({'detail': 'Текущий пароль неверный.'}, status=400)
        if len(new) < 6:
            return Response({'detail': 'Новый пароль — минимум 6 символов.'}, status=400)
        if new == current:
            return Response({'detail': 'Новый пароль совпадает с текущим.'}, status=400)

        request.user.set_password(new)
        request.user.save(update_fields=['password'])
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.must_change_password = False
        profile.save(update_fields=['must_change_password'])
        return Response({'detail': 'Пароль обновлён.'})


class MyPinView(APIView):
    """POST {pin, current_pin?} — смена собственного PIN.
    Если PIN уже установлен, требуется текущий PIN."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pin = str(request.data.get('pin', '')).strip()
        if not pin.isdigit() or len(pin) != 4:
            return Response({'detail': 'PIN должен состоять из 4 цифр.'}, status=400)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.pin_hash:
            current = str(request.data.get('current_pin', '')).strip()
            if not check_password(current, profile.pin_hash):
                return Response({'detail': 'Текущий PIN неверный.'}, status=400)

        profile.pin_hash = make_password(pin)
        profile.save(update_fields=['pin_hash'])
        return Response({'detail': 'PIN обновлён.', 'has_pin': True})


class PinLoginThrottle(AnonRateThrottle):
    scope = 'pin_login'


class PinLoginView(APIView):
    """POST {user_id, pin} → JWT-токены."""
    permission_classes = [AllowAny]
    throttle_classes = [PinLoginThrottle]

    def post(self, request):
        user_id = request.data.get('user_id')
        pin     = str(request.data.get('pin', '')).strip()

        if not user_id or not pin:
            return Response({'detail': 'Укажите user_id и pin.'}, status=400)

        try:
            user = User.objects.select_related('profile').get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден.'}, status=404)

        profile = getattr(user, 'profile', None)
        if not profile or not profile.pin_hash:
            return Response({'detail': 'PIN не установлен. Обратитесь к администратору.'}, status=400)

        if not check_password(pin, profile.pin_hash):
            return Response({'detail': 'Неверный PIN.'}, status=401)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
        })