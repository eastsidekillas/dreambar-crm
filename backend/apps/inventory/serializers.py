from rest_framework import serializers
from .models import (
    Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem,
    ReceiptImport,
)


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


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)
    subtotal     = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseOrderItem
        fields = ['id', 'order', 'product', 'product_name', 'product_unit',
                  'qty_ordered', 'qty_received', 'unit_price', 'subtotal']
        read_only_fields = ['order']

    def get_subtotal(self, obj):
        return float(obj.qty_received * obj.unit_price)


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items          = PurchaseOrderItemSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total          = serializers.SerializerMethodField()
    status_label   = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = PurchaseOrder
        fields = ['id', 'status', 'status_label', 'store', 'created_by', 'created_by_name',
                  'created_at', 'received_at', 'notes', 'total', 'items']
        read_only_fields = ['created_by', 'created_at', 'received_at']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        profile = getattr(obj.created_by, 'profile', None)
        return profile.get_display() if profile else (obj.created_by.get_full_name() or obj.created_by.username)

    def get_total(self, obj):
        return float(sum(i.qty_received * i.unit_price for i in obj.items.all()))

class ReceiptImportSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = ReceiptImport
        fields = ['id', 'qr', 'hash', 'status', 'status_label', 'error', 'store',
                  'total', 'purchased_at', 'result', 'purchase', 'created_at']
        read_only_fields = ['hash', 'status', 'error', 'store', 'total',
                            'purchased_at', 'result', 'purchase', 'created_at']
