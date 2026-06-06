from django.contrib import admin
from .models import (
    Shift, MenuCategory, MenuItem, Order, OrderItem, EntryTicket, Receipt,
    Printer, PrintJob, DeletedOrderItem,
)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['unit_price']


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['date', 'opened_by', 'is_open', 'opened_at', 'closed_at']
    list_filter = ['is_open', 'date']


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'sort_order']


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'cost_price', 'is_active', 'print_station']
    list_filter = ['category__type', 'print_station', 'is_active']
    list_editable = ['print_station']
    search_fields = ['name']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'shift', 'waiter', 'table_number', 'status', 'created_at']
    list_filter = ['status', 'shift']
    inlines = [OrderItemInline]


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ['code', 'shift', 'table_number', 'waiter', 'payment_method', 'total', 'issued_at']
    list_filter = ['shift', 'payment_method']
    search_fields = ['number', 'table_number']


@admin.register(EntryTicket)
class EntryTicketAdmin(admin.ModelAdmin):
    list_display = ['bracelet_number', 'shift', 'price', 'sold_at', 'created_by']
    list_filter = ['shift']
    search_fields = ['bracelet_number']


@admin.register(Printer)
class PrinterAdmin(admin.ModelAdmin):
    list_display = ['name', 'connection', 'host', 'port', 'is_default', 'is_active']
    list_filter = ['connection', 'is_active']


@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'printer', 'kind', 'receipt', 'status', 'created_at', 'sent_at']
    list_filter = ['status', 'printer', 'kind']
    readonly_fields = ['payload', 'created_at', 'sent_at']


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
