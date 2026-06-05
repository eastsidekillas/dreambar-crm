from django.urls import path
from .views import DashboardView, ShiftAnalyticsView, TopItemsView, MonthlyView

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='analytics-dashboard'),
    path('shifts/', ShiftAnalyticsView.as_view(), name='analytics-shifts'),
    path('top-items/', TopItemsView.as_view(), name='analytics-top-items'),
    path('monthly/', MonthlyView.as_view(), name='analytics-monthly'),
]
