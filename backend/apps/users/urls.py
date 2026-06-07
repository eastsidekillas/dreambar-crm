from django.urls import path

from .views import (
    UserProfileListView, EmployeeDetailView,
    EmployeeActivityView, EmployeeOrdersView,
    StaffListView, PinLoginView,
)

urlpatterns = [
    path('employees/',                 UserProfileListView.as_view(),  name='employees'),
    path('employees/activity/',        EmployeeActivityView.as_view(), name='employee-activity'),
    path('employees/orders/',          EmployeeOrdersView.as_view(),   name='employee-orders'),
    path('employees/<int:user_id>/',   EmployeeDetailView.as_view(),   name='employee-detail'),
    path('auth/staff/',                StaffListView.as_view(),        name='staff-list'),
    path('auth/pin/',                  PinLoginView.as_view(),         name='pin-login'),
]