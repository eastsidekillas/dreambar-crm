from django.contrib import admin
from .models import MenuSection, MenuCategory, MenuItem


@admin.register(MenuSection)
class MenuSectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'station_type', 'icon', 'sort_order', 'is_active']
    list_editable = ['sort_order', 'is_active']


class MenuItemInline(admin.TabularInline):
    model = MenuItem
    extra = 0
    fields = ['name', 'volume', 'price', 'cost_price', 'print_station', 'is_active', 'is_out_of_stock']


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'section', 'print_station', 'sort_order', 'is_active']
    list_filter = ['section__station_type', 'is_active']
    list_editable = ['print_station', 'sort_order', 'is_active']
    inlines = [MenuItemInline]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'cost_price', 'print_station', 'is_active', 'is_out_of_stock']
    list_filter = ['category__section__station_type', 'print_station', 'is_active']
    list_editable = ['print_station']
    search_fields = ['name']