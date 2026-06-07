from django.contrib import admin
from .models import Receipt


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ['code', 'shift', 'table_number', 'waiter', 'payment_method', 'total', 'issued_at']
    list_filter = ['shift', 'payment_method']
    search_fields = ['number', 'table_number']
