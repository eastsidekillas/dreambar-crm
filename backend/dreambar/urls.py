from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    profile = getattr(u, 'profile', None)
    role = profile.role if profile else ('admin' if u.is_staff else 'waiter')
    allowed = profile.allowed_roles if profile and profile.allowed_roles else []
    return Response({
        'id': u.id,
        'username': u.username,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'display_name': profile.get_display() if profile else (u.get_full_name() or u.username),
        'is_staff': u.is_staff,
        'role': role,
        'allowed_roles': allowed if len(allowed) > 1 else [],
        'has_pin': bool(profile.pin_hash) if profile else False,
    })


urlpatterns = [
    path('admin-as/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', me, name='me'),
    path('api/', include('apps.orders.urls')),
    path('api/', include('apps.menu.urls')),
    path('api/', include('apps.users.urls')),
    path('api/', include('apps.shifts.urls')),
    path('api/', include('apps.tickets.urls')),
    path('api/', include('apps.printers.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/exports/', include('apps.exports.urls')),
    path('api/', include('apps.audit.urls')),
    path('api/', include('apps.reservations.urls')),
    path('api/tables/', include('apps.tables.urls')),
]
