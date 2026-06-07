from rest_framework import serializers
from django.contrib.auth.models import User

from apps.receipts.models import Receipt
from .models import Order, OrderItem

# Re-export so existing imports like `from apps.orders.serializers import ShiftSerializer` не ломаются
from apps.shifts.serializers import ShiftSerializer               # noqa: F401
from apps.tickets.serializers import EntryTicketSerializer        # noqa: F401
from apps.printers.serializers import PrintJobAgentSerializer     # noqa: F401


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_type = serializers.CharField(source='menu_item.category.section.station_type', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_name', 'menu_item_type',
                  'quantity', 'unit_price', 'subtotal', 'guest_no', 'receipt',
                  'kitchen_status']


class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['menu_item', 'quantity', 'guest_no']

    def create(self, validated_data):
        menu_item = validated_data['menu_item']
        validated_data['unit_price'] = menu_item.price
        return super().create(validated_data)


class ReceiptItemSerializer(serializers.ModelSerializer):
    menu_item_name   = serializers.CharField(source='menu_item.name',   read_only=True)
    menu_item_volume = serializers.CharField(source='menu_item.volume', read_only=True)
    menu_item_type   = serializers.CharField(source='menu_item.category.section.station_type', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item_name', 'menu_item_volume', 'menu_item_type',
                  'quantity', 'unit_price', 'subtotal']


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
