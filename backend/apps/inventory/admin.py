from django.contrib import admin
from .models import Product, MenuItemComponent, InventoryMovement


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = ['name', 'unit', 'stock_quantity', 'min_stock', 'pack_size', 'purchase_price', 'is_active']
    list_editable = ['stock_quantity', 'min_stock', 'purchase_price', 'is_active']
    list_filter   = ['is_active', 'unit']
    search_fields = ['name']


class ComponentInline(admin.TabularInline):
    model = MenuItemComponent
    extra = 1


@admin.register(MenuItemComponent)
class ComponentAdmin(admin.ModelAdmin):
    list_display        = ['menu_item', 'product', 'quantity']
    list_select_related = True
    list_filter         = ['product']
    search_fields       = ['menu_item__name', 'product__name']


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display        = ['created_at', 'product', 'quantity', 'reason', 'shift', 'created_by']
    list_filter         = ['reason', 'shift']
    list_select_related = True
    readonly_fields     = ['created_at', 'order_item', 'shift', 'created_by']
    search_fields       = ['product__name', 'note']
    ordering            = ['-created_at']