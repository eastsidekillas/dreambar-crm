from django.urls import path
from .views import SystemStatusView, SystemControlView

urlpatterns = [
    path('status/', SystemStatusView.as_view(), name='system-status'),
    path('<str:action>/', SystemControlView.as_view(), name='system-control'),
]