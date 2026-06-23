from rest_framework import serializers
from .models import SystemState


class SystemStateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemState
        fields = ['is_stopped', 'message', 'updated_at', 'updated_by_name']
        read_only_fields = fields

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None