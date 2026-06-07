import math
from decimal import Decimal

from django.db.models import Sum, F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser

from apps.orders.models import OrderItem
from .models import Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem
from .serializers import (
    ProductSerializer, ComponentSerializer, InventoryMovementSerializer,
    PurchaseOrderSerializer, PurchaseOrderItemSerializer,
)
from .services import adjust_stock


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset           = Product.objects.all()
    serializer_class   = ProductSerializer

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Продукты у которых остаток ниже минимального порога."""
        qs = Product.objects.filter(
            is_active=True, min_stock__isnull=False,
            stock_quantity__lt=F('min_stock'),
        )
        return Response(ProductSerializer(qs, many=True).data)


class ComponentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class   = ComponentSerializer
    filterset_fields   = ['menu_item']

    def get_queryset(self):
        return MenuItemComponent.objects.select_related('product', 'menu_item').all()


class InventoryMovementViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class   = InventoryMovementSerializer
    filterset_fields   = ['product', 'reason', 'shift']

    def get_queryset(self):
        return InventoryMovement.objects.select_related(
            'product', 'created_by', 'created_by__profile', 'shift'
        ).all()

    @action(detail=False, methods=['post'])
    def adjust(self, request):
        """Ручная корректировка остатка: приход / списание / инвентаризация."""
        product_id = request.data.get('product')
        raw_qty    = request.data.get('quantity')
        reason     = request.data.get('reason', 'manual_in')
        note       = request.data.get('note', '')

        if not product_id or raw_qty is None:
            return Response({'detail': 'product и quantity обязательны.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_reasons = {'manual_in', 'manual_out', 'adjustment'}
        if reason not in valid_reasons:
            return Response({'detail': f'reason должен быть одним из {valid_reasons}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'detail': 'Продукт не найден.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            delta = Decimal(str(raw_qty))
        except Exception:
            return Response({'detail': 'Некорректное количество.'}, status=status.HTTP_400_BAD_REQUEST)

        if reason == 'manual_out':
            delta = -abs(delta)
        elif reason == 'manual_in':
            delta = abs(delta)
        # adjustment может быть любым знаком — берём как есть

        adjust_stock(product, delta, reason=reason, user=request.user, note=note)
        product.refresh_from_db()
        return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)


class ConsumptionView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        shift_id  = request.query_params.get('shift')

        qs = OrderItem.objects.filter(order__status='closed')
        if shift_id:
            qs = qs.filter(order__shift_id=shift_id)
        else:
            if date_from:
                qs = qs.filter(order__shift__date__gte=date_from)
            if date_to:
                qs = qs.filter(order__shift__date__lte=date_to)

        sold = {
            row['menu_item_id']: row['total_qty']
            for row in qs.values('menu_item_id').annotate(total_qty=Sum('quantity'))
        }
        if not sold:
            return Response([])

        components = MenuItemComponent.objects.filter(
            menu_item_id__in=sold.keys()
        ).select_related('product')

        consumption: dict[int, dict] = {}
        for comp in components:
            pid = comp.product_id
            if pid not in consumption:
                p = comp.product
                consumption[pid] = {
                    'product_id':     pid,
                    'product_name':   p.name,
                    'unit':           p.unit,
                    'pack_size':      float(p.pack_size),
                    'purchase_price': float(p.purchase_price),
                    'stock_quantity': float(p.stock_quantity),
                    'total_units':    0.0,
                }
            consumption[pid]['total_units'] += float(comp.quantity) * sold[comp.menu_item_id]

        result = []
        for row in sorted(consumption.values(), key=lambda x: x['product_name']):
            total_units  = row['total_units']
            pack_size    = row['pack_size']
            total_packs  = total_units / pack_size if pack_size else 0
            packs_to_buy = math.ceil(total_packs)
            result.append({
                **row,
                'total_units':  round(total_units, 2),
                'total_packs':  round(total_packs, 2),
                'packs_to_buy': packs_to_buy,
                'total_cost':   round(packs_to_buy * row['purchase_price'], 2),
            })

        return Response(result)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class   = PurchaseOrderSerializer

    def get_queryset(self):
        return PurchaseOrder.objects.prefetch_related(
            'items__product', 'created_by__profile'
        ).all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def from_low_stock(self, request):
        """Создаёт черновик заявки из позиций ниже минимального остатка."""
        low = Product.objects.filter(
            is_active=True, min_stock__isnull=False,
            stock_quantity__lt=F('min_stock'),
        )
        if not low.exists():
            return Response({'detail': 'Всё в норме — нет позиций ниже минимума.'}, status=400)

        order = PurchaseOrder.objects.create(created_by=request.user)
        for p in low:
            need = p.min_stock - p.stock_quantity
            # округляем вверх до целой упаковки
            packs = math.ceil(float(need) / float(p.pack_size)) if p.pack_size else 1
            qty   = Decimal(str(packs)) * p.pack_size
            PurchaseOrderItem.objects.create(
                order=order, product=p,
                qty_ordered=qty,
                qty_received=qty,
                unit_price=p.purchase_price,
            )

        return Response(PurchaseOrderSerializer(order).data, status=201)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Оприходовать заказ: обновить остатки по qty_received, поставить статус received."""
        order = self.get_object()
        if order.status == 'received':
            return Response({'detail': 'Заказ уже оприходован.'}, status=400)

        for item_data in request.data.get('items', []):
            try:
                item = order.items.get(pk=item_data['id'])
            except PurchaseOrderItem.DoesNotExist:
                continue
            item.qty_received = Decimal(str(item_data.get('qty_received', item.qty_received)))
            item.unit_price   = Decimal(str(item_data.get('unit_price',   item.unit_price)))
            item.save()

            if item.qty_received > 0:
                adjust_stock(
                    item.product,
                    delta=item.qty_received,
                    reason='manual_in',
                    user=request.user,
                    note=f'Закупка #{order.pk}',
                )
                # обновляем закупочную цену продукта
                item.product.purchase_price = item.unit_price
                item.product.save(update_fields=['purchase_price'])

        order.status      = 'received'
        order.received_at = timezone.now()
        order.save(update_fields=['status', 'received_at'])

        return Response(PurchaseOrderSerializer(order).data)

    @action(detail=True, methods=['patch'], url_path='items/(?P<item_pk>[^/.]+)')
    def update_item(self, request, pk=None, item_pk=None):
        """Обновить позицию черновика (кол-во, цена)."""
        order = self.get_object()
        try:
            item = order.items.get(pk=item_pk)
        except PurchaseOrderItem.DoesNotExist:
            return Response({'detail': 'Позиция не найдена.'}, status=404)
        serializer = PurchaseOrderItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)