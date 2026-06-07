from django.urls import path
from .views import DashboardView, ShiftAnalyticsView, TopItemsView, MonthlyView, ShiftDetailView, SalesReportView, ForecastView

urlpatterns = [
    path('dashboard/',              DashboardView.as_view(),      name='analytics-dashboard'),
    path('shifts/',                 ShiftAnalyticsView.as_view(), name='analytics-shifts'),
    path('shift-detail/<int:shift_id>/', ShiftDetailView.as_view(), name='analytics-shift-detail'),
    path('sales-report/',           SalesReportView.as_view(),    name='analytics-sales-report'),
    path('top-items/',              TopItemsView.as_view(),        name='analytics-top-items'),
    path('monthly/',                MonthlyView.as_view(),         name='analytics-monthly'),
    path('forecast/',               ForecastView.as_view(),        name='analytics-forecast'),
]
