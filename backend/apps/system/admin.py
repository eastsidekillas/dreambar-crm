from django.contrib import admin
from .models import SystemState


@admin.register(SystemState)
class SystemStateAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'is_stopped', 'updated_at', 'updated_by')
    readonly_fields = ('updated_at', 'updated_by')

    def has_add_permission(self, request):
        # Синглтон: запись всегда одна (pk=1).
        return not SystemState.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)