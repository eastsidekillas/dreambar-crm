from django.contrib import admin
from .models import EntryTicket


@admin.register(EntryTicket)
class EntryTicketAdmin(admin.ModelAdmin):
    list_display = ['bracelet_number', 'shift', 'price', 'sold_at', 'created_by']
    list_filter = ['shift']
    search_fields = ['bracelet_number']
