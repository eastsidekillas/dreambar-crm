from django.contrib import admin
from .models import Shift


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['date', 'opened_by', 'is_open', 'opened_at', 'closed_at']
    list_filter = ['is_open', 'date']
