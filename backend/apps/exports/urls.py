from django.urls import path
from .views import ExportShiftView, ExportReportView

urlpatterns = [
    path('shift/<int:shift_id>/', ExportShiftView.as_view(), name='export-shift'),
    path('report/', ExportReportView.as_view(), name='export-report'),
]
