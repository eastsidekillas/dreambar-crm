from rest_framework import serializers
from django.contrib.auth.models import User

from apps.receipts.models import Receipt
from .models import Order, OrderItem, OrderItemModifier

# Re-export so existing imports like `from apps.orders.serializers import ShiftSerializer` не ломаются
from apps.shifts.serializers import ShiftSerializer               # noqa: F401
from apps.tickets.serializers import EntryTicketSerializer        # noqa: F401
from apps.printers.serializers import PrintJobAgentSerializer     # noqa: F401


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']


class OrderItemModifierSerializer(serializers.ModelSerializer):
    modifier_name  = serializers.CharField(source='modifier.name',        read_only=True)
    price_delta    = serializers.DecimalField(source='modifier.price_delta',
                                              max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model  = OrderItemModifier
        fields = ['id', 'modifier', 'modifier_name', 'price_delta', 'quantity']


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_type = serializers.CharField(source='menu_item.category.section.station_type', read_only=True)
    subtotal       = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    modifiers      = OrderItemModifierSerializer(source='selected_modifiers', many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_name', 'menu_item_type',
                  'quantity', 'unit_price', 'subtotal', 'guest_no', 'receipt',
                  'kitchen_status', 'modifiers']


class OrderItemCreateSerializer(serializers.ModelSerializer):
    modifiers = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = OrderItem
        fields = ['menu_item', 'quantity', 'guest_no', 'modifiers']

    def create(self, validated_data):
        modifier_ids = validated_data.pop('modifiers', [])
        menu_item    = validated_data['menu_item']
        validated_data['unit_price'] = menu_item.price
        item = super().create(validated_data)
        for mid in modifier_ids:
            try:
                from apps.menu.models import Modifier
                mod = Modifier.objects.get(pk=mid, is_active=True)
                OrderItemModifier.objects.create(order_item=item, modifier=mod)
                # добавляем price_delta к unit_price
                item.unit_price += mod.price_delta
            except Modifier.DoesNotExist:
                pass
        if modifier_ids:
            item.save(update_fields=['unit_price'])
        return item


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
    deposit_method_label = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = ['id', 'order', 'shift', 'number', 'code', 'table_number',
                  'waiter', 'waiter_name', 'payment_method', 'payment_label',
                  'total', 'deposit_amount', 'deposit_method', 'deposit_method_label',
                  'issued_at', 'items']

    def get_waiter_name(self, obj):
        if obj.waiter:
            return obj.waiter.get_full_name() or obj.waiter.username
        return None

    def get_deposit_method_label(self, obj):
        labels = {'cash': 'Наличные', 'transfer': 'Перевод'}
        return labels.get(obj.deposit_method, '') if obj.deposit_method else ''


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    waiter_name = serializers.SerializerMethodField()
    reservation_info = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'shift', 'waiter', 'waiter_name', 'table_number', 'guests',
                  'status', 'created_at', 'updated_at', 'closed_at', 'notes',
                  'reservation', 'reservation_info',
                  'items', 'receipts', 'total', 'is_paid']
        read_only_fields = ['waiter', 'created_at', 'updated_at', 'closed_at']

    def get_waiter_name(self, obj):
        if obj.waiter:
            return obj.waiter.get_full_name() or obj.waiter.username
        return None

    def get_reservation_info(self, obj):
        r = obj.reservation
        if not r:
            return None
        return {
            'id': r.id,
            'name': r.name,
            'phone': r.phone,
            'guests_count': r.guests_count,
            'deposit_amount': str(r.deposit_amount),
            'deposit_method': r.deposit_method,
            'deposit_method_label': r.get_deposit_method_display() if r.deposit_method else '',
            'deposit_paid': r.deposit_paid,
            'status': r.status,
            'wishes': r.wishes,
        }


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True, required=False)

    class Meta:
        model = Order
        fields = ['id', 'shift', 'table_number', 'guests', 'notes', 'reservation', 'items']
        read_only_fields = ['id']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            item_data['unit_price'] = item_data['menu_item'].price
            OrderItem.objects.create(order=order, **item_data)
        return order
