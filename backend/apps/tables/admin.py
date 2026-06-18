from django.contrib import admin
from .models import Zone, Table


class TableInline(admin.TabularInline):
    model = Table
    extra = 1


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'sort', 'requires_deposit', 'min_deposit']
    list_editable = ['requires_deposit', 'min_deposit']
    inlines = [TableInline]


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['number', 'zone', 'seats', 'is_active']
    list_filter  = ['zone', 'is_active']
