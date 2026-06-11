from django.urls import path
from .views import (
    PrinterListView, PrinterDetailView, PrinterTestView,
    AgentJobsView, AgentJobAckView, ReceiptSettingsView,
)

urlpatterns = [
    path('printers/',                          PrinterListView.as_view(),     name='printers'),
    path('printers/receipt-settings/',         ReceiptSettingsView.as_view(), name='receipt-settings'),
    path('printers/<int:pk>/',                 PrinterDetailView.as_view(),   name='printer-detail'),
    path('printers/<int:pk>/test/',            PrinterTestView.as_view(),     name='printer-test'),
    path('print/agent/jobs/',                  AgentJobsView.as_view(),       name='agent-jobs'),
    path('print/agent/jobs/<int:job_id>/ack/', AgentJobAckView.as_view(),     name='agent-job-ack'),
]
