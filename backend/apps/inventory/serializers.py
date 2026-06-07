from rest_framework import serializers
from .models import Product, MenuItemComponent, InventoryMovement


class ProductSerializer(serializers.ModelSerializer):
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'unit', 'pack_size', 'purchase_price',
            'stock_quantity', 'min_stock', 'is_active', 'is_low',
        ]


class ComponentSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)

    class Meta:
        model  = MenuItemComponent
        fields = ['id', 'menu_item', 'product', 'product_name', 'product_unit', 'quantity']


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = InventoryMovement
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'quantity', 'reason', 'order_item', 'shift',
            'created_by', 'created_by_name', 'created_at', 'note',
        ]
        read_only_fields = ['created_at', 'created_by']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        profile = getattr(obj.created_by, 'profile', None)
        return profile.get_display() if profile else (obj.created_by.get_full_name() or obj.created_by.username)