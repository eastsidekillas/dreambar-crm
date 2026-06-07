from django.contrib import admin
from .models import DeletedOrderItem


@admin.register(DeletedOrderItem)
class DeletedOrderItemAdmin(admin.ModelAdmin):
    list_display = [
        'deleted_at', 'deleted_by', 'table_number', 'menu_item_name',
        'menu_item_volume', 'quantity', 'unit_price', 'subtotal_display',
        'kitchen_status', 'shift',
    ]
    list_filter  = ['shift', 'deleted_by', 'kitchen_status']
    search_fields = ['menu_item_name', 'table_number', 'deleted_by__username',
                     'deleted_by__first_name', 'deleted_by__last_name']
    readonly_fields = [
        'deleted_at', 'deleted_by', 'order', 'shift', 'table_number',
        'menu_item_name', 'menu_item_volume', 'quantity', 'unit_price', 'kitchen_status',
    ]
    ordering = ['-deleted_at']

    def subtotal_display(self, obj):
        return f'{obj.subtotal:.0f} ₽'
    subtotal_display.short_description = 'Сумма'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
