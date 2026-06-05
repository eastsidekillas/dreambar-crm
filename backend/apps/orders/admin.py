from django.contrib import admin
from .models import Shift, MenuCategory, MenuItem, Order, OrderItem, EntryTicket, Receipt


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
    list_display = ['name', 'category', 'price', 'cost_price', 'is_active']
    list_filter = ['category__type', 'is_active']
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
