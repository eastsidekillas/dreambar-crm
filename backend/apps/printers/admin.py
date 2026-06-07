from django.contrib import admin
from .models import Printer, PrintJob


@admin.register(Printer)
class PrinterAdmin(admin.ModelAdmin):
    list_display = ['name', 'connection', 'host', 'port', 'is_default', 'is_active']
    list_filter = ['connection', 'is_active']


@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'printer', 'kind', 'receipt', 'status', 'created_at', 'sent_at']
    list_filter = ['status', 'printer', 'kind']
    readonly_fields = ['payload', 'created_at', 'sent_at']
