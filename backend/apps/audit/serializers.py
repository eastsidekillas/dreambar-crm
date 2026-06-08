from rest_framework import serializers
from .models import DeletedOrderItem


class DeletedOrderItemSerializer(serializers.ModelSerializer):
    deleted_by_name = serializers.SerializerMethodField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = DeletedOrderItem
        fields = [
            'id', 'deleted_at', 'deleted_by', 'deleted_by_name',
            'order', 'shift', 'table_number',
            'menu_item_name', 'menu_item_volume',
            'quantity', 'unit_price', 'subtotal',
            'kitchen_status',
        ]

    def get_deleted_by_name(self, obj):
        if obj.deleted_by:
            return obj.deleted_by.get_full_name() or obj.deleted_by.username
        return None