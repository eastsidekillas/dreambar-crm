from rest_framework import serializers
from .models import Shift


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.SerializerMethodField()
    total_revenue  = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    orders_count   = serializers.IntegerField(read_only=True)
    tickets_count  = serializers.IntegerField(read_only=True)

    class Meta:
        model = Shift
        fields = ['id', 'date', 'opened_by', 'opened_by_name', 'opened_at',
                  'closed_at', 'is_open', 'notes',
                  'total_revenue', 'orders_count', 'tickets_count']
        read_only_fields = ['opened_by', 'opened_at', 'closed_at']

    def get_opened_by_name(self, obj):
        if obj.opened_by:
            return obj.opened_by.get_full_name() or obj.opened_by.username
        return None
