from django.contrib import admin
from django.db.models import ProtectedError
from django.contrib import messages

from .models import Menu, MenuSection, MenuCategory, MenuItem


class MenuSectionInline(admin.TabularInline):
    model  = MenuSection
    extra  = 0
    fields = ['name', 'station_type', 'icon', 'sort_order', 'is_active']
    show_change_link = True


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display  = ['name', 'is_active', 'created_at']
    list_filter   = ['is_active']
    inlines       = [MenuSectionInline]
    actions       = ['make_active']

    @admin.action(description='Активировать выбранное меню')
    def make_active(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, 'Выберите ровно одно меню для активации.', messages.WARNING)
            return
        menu = queryset.first()
        menu.activate()
        self.message_user(request, f'Меню «{menu.name}» активировано.')


class MenuItemInline(admin.TabularInline):
    model  = MenuItem
    extra  = 0
    fields = ['name', 'volume', 'price', 'cost_price', 'print_station', 'is_active', 'is_out_of_stock']


@admin.register(MenuSection)
class MenuSectionAdmin(admin.ModelAdmin):
    list_display  = ['name', 'menu', 'station_type', 'icon', 'sort_order', 'is_active']
    list_filter   = ['menu', 'station_type', 'is_active']
    list_editable = ['sort_order', 'is_active']


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'section', 'print_station', 'sort_order', 'is_active']
    list_filter   = ['section__menu', 'section__station_type', 'is_active']
    list_editable = ['print_station', 'sort_order', 'is_active']
    inlines       = [MenuItemInline]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display  = ['name', 'category', 'price', 'cost_price', 'print_station', 'is_active', 'is_out_of_stock']
    list_filter   = ['category__section__menu', 'category__section__station_type', 'print_station', 'is_active']
    list_editable = ['price', 'print_station', 'is_active']
    search_fields = ['name']

    def delete_model(self, request, obj):
        try:
            obj.delete()
        except ProtectedError:
            self.message_user(
                request,
                f'«{obj.name}» нельзя удалить: есть связанные заказы. Деактивируйте позицию.',
                messages.ERROR,
            )

    def delete_queryset(self, request, queryset):
        failed = []
        for obj in queryset:
            try:
                obj.delete()
            except ProtectedError:
                failed.append(obj.name)
        if failed:
            self.message_user(
                request,
                f'Не удалось удалить (есть заказы): {", ".join(failed)}. Деактивируйте их.',
                messages.ERROR,
            )