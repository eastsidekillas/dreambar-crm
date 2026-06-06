import base64

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Shift, MenuCategory, MenuItem, Order, OrderItem, EntryTicket, Receipt, PrintJob


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']


class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'type', 'sort_order']


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_type = serializers.CharField(source='category.type', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'sort_order', 'category', 'category_name', 'category_type']


class MenuItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'sort_order', 'category']


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_type = serializers.CharField(source='menu_item.category.type', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_name', 'menu_item_type',
                  'quantity', 'unit_price', 'subtotal', 'guest_no', 'receipt']


class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['menu_item', 'quantity', 'guest_no']

    def create(self, validated_data):
        menu_item = validated_data['menu_item']
        validated_data['unit_price'] = menu_item.price
        return super().create(validated_data)


class ReceiptItemSerializer(serializers.ModelSerializer):
    """Позиция в составе чека (read-only снимок для печати)."""
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_type = serializers.CharField(source='menu_item.category.type', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item_name', 'menu_item_type', 'quantity', 'unit_price', 'subtotal']


class ReceiptSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True, read_only=True)
    code = serializers.CharField(read_only=True)
    waiter_name = serializers.SerializerMethodField()
    payment_label = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = Receipt
        fields = ['id', 'order', 'shift', 'number', 'code', 'table_number',
                  'waiter', 'waiter_name', 'payment_method', 'payment_label',
                  'total', 'issued_at', 'items']

    def get_waiter_name(self, obj):
        if obj.waiter:
            return obj.waiter.get_full_name() or obj.waiter.username
        return None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    waiter_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'shift', 'waiter', 'waiter_name', 'table_number', 'guests',
                  'status', 'created_at', 'updated_at', 'closed_at', 'notes',
                  'items', 'receipts', 'total', 'is_paid']
        read_only_fields = ['waiter', 'created_at', 'updated_at', 'closed_at']

    def get_waiter_name(self, obj):
        if obj.waiter:
            return obj.waiter.get_full_name() or obj.waiter.username
        return None


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True, required=False)

    class Meta:
        model = Order
        fields = ['id', 'shift', 'table_number', 'guests', 'notes', 'items']
        read_only_fields = ['id']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            item_data['unit_price'] = item_data['menu_item'].price
            OrderItem.objects.create(order=order, **item_data)
        return order


class EntryTicketSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EntryTicket
        fields = ['id', 'shift', 'bracelet_number', 'price', 'sold_at',
                  'created_by', 'created_by_name']
        read_only_fields = ['created_by', 'sold_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.SerializerMethodField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    orders_count = serializers.IntegerField(read_only=True)
    tickets_count = serializers.IntegerField(read_only=True)

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


class PrintJobAgentSerializer(serializers.ModelSerializer):
    """Представление задания для локального агента: ESC/POS-пакет в base64."""
    payload_b64 = serializers.SerializerMethodField()

    class Meta:
        model = PrintJob
        fields = ['id', 'kind', 'status', 'payload_b64', 'created_at']

    def get_payload_b64(self, obj):
        return base64.b64encode(bytes(obj.payload)).decode('ascii')
