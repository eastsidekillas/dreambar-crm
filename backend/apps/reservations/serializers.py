from rest_framework import serializers
from .models import Reservation


class ReservationSerializer(serializers.ModelSerializer):
    status_label         = serializers.CharField(source='get_status_display', read_only=True)
    deposit_method_label = serializers.CharField(source='get_deposit_method_display', read_only=True)
    created_by_name      = serializers.SerializerMethodField()
    # Derived from the FK — used across the codebase for table matching
    table_number         = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'name', 'phone', 'date', 'time_start', 'time_end',
            'table', 'table_number',
            'guests_count', 'wishes',
            'deposit_amount', 'deposit_method', 'deposit_method_label', 'deposit_paid',
            'status', 'status_label', 'notes',
            'created_at', 'created_by', 'created_by_name',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_table_number(self, obj):
        return obj.table.number if obj.table_id else ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
