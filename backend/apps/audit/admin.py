from django.contrib import admin
from .models import DeletedOrderItem, IdempotencyKey


@admin.register(IdempotencyKey)
class IdempotencyKeyAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'key', 'method', 'path', 'completed', 'response_status']
    list_filter  = ['completed', 'method']
    search_fields = ['key', 'path']
    readonly_fields = ['key', 'method', 'path', 'completed', 'response_status',
                       'response_body', 'content_type', 'created_at']
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


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
