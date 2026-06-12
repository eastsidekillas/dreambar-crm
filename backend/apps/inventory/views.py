import math
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from apps.orders.models import OrderItem
from .models import Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem
from .serializers import (
    ProductSerializer, ComponentSerializer, InventoryMovementSerializer,
    PurchaseOrderSerializer, PurchaseOrderItemSerializer,
)
from .services import adjust_stock


class ProductViewSet(viewsets.ModelViewSet):
    queryset         = Product.objects.all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'low_stock'):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Продукты у которых остаток ниже минимального порога."""
        qs = Product.objects.filter(
            is_active=True, min_stock__isnull=False,
            stock_quantity__lt=F('min_stock'),
        )
        return Response(ProductSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def from_menu(self, request):
        """POST {menu_item_ids: [..]} — создаёт товары склада из позиций меню
        (готовая продукция: бутылки, снеки). Для каждой позиции: Product в штуках
        + рецептура «1 шт», чтобы продажи сразу списывались со склада.
        Позиции, у которых рецептура уже есть, пропускаются."""
        from apps.menu.models import MenuItem

        ids = request.data.get('menu_item_ids')
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'menu_item_ids — непустой список.'}, status=status.HTTP_400_BAD_REQUEST)

        items = MenuItem.objects.filter(pk__in=ids).prefetch_related('components')
        created = []
        for mi in items:
            if mi.components.exists():
                continue
            product = Product.objects.create(
                name=mi.name,
                unit='шт',
                pack_size=Decimal('1'),
                purchase_price=mi.cost_price,
            )
            MenuItemComponent.objects.create(menu_item=mi, product=product, quantity=Decimal('1'))
            created.append(product)

        if not created:
            return Response({'detail': 'У выбранных позиций рецептуры уже заполнены.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


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

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def stocktake(self, request):
        """POST {items: [{product: id, actual_qty: число}]} — массовая инвентаризация.
        Для каждого товара записывает adjustment на разницу факт − учёт."""
        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response({'detail': 'items — непустой список.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed = []
        for it in items:
            try:
                pid    = int(it['product'])
                actual = Decimal(str(it['actual_qty']))
            except (KeyError, TypeError, ValueError, ArithmeticError):
                return Response({'detail': f'Некорректная строка: {it}'}, status=status.HTTP_400_BAD_REQUEST)
            if actual < 0:
                return Response({'detail': 'actual_qty не может быть отрицательным.'}, status=status.HTTP_400_BAD_REQUEST)
            parsed.append((pid, actual))

        # Блокируем строки до конца транзакции: дельта факт−учёт должна считаться
        # от остатка, который не изменит параллельная продажа/списание.
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=[pid for pid, _ in parsed])}
        missing = [pid for pid, _ in parsed if pid not in products]
        if missing:
            return Response({'detail': f'Продукты не найдены: {missing}'}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for pid, actual in parsed:
            p = products[pid]
            delta = actual - p.stock_quantity
            if delta != 0:
                adjust_stock(p, delta, reason='adjustment', user=request.user, note='Инвентаризация')
                p.refresh_from_db()
            updated.append(p)
        return Response(ProductSerializer(updated, many=True).data)


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


class StockReportView(APIView):
    """Сводка по складу за период: потрачено / себестоимость продаж / выручка /
    заработано / расхождение по инвентаризации.

    Суммы движений считаются по текущей цене за единицу товара
    (purchase_price / pack_size) — историческая цена в движениях не хранится.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.receipts.models import Receipt

        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        movements = InventoryMovement.objects.select_related('product')
        receipts  = Receipt.objects.all()
        if date_from:
            movements = movements.filter(created_at__date__gte=date_from)
            receipts  = receipts.filter(issued_at__date__gte=date_from)
        if date_to:
            movements = movements.filter(created_at__date__lte=date_to)
            receipts  = receipts.filter(issued_at__date__lte=date_to)

        def unit_cost(p):
            return (p.purchase_price / p.pack_size) if p.pack_size else Decimal('0')

        spent = cost_of_sales = writeoffs = discrepancy = Decimal('0')
        disc_rows: dict[int, dict] = {}
        for m in movements:
            value = m.quantity * unit_cost(m.product)  # знак как у количества
            if m.reason == 'manual_in':
                spent += value
            elif m.reason == 'sale':
                cost_of_sales += -value
            elif m.reason == 'manual_out':
                writeoffs += -value
            elif m.reason == 'adjustment':
                discrepancy += value
                row = disc_rows.setdefault(m.product_id, {
                    'product_id': m.product_id,
                    'product_name': m.product.name,
                    'unit': m.product.unit,
                    'quantity': Decimal('0'),
                    'value': Decimal('0'),
                })
                row['quantity'] += m.quantity
                row['value']    += value

        revenue = receipts.aggregate(s=Sum('total'))['s'] or Decimal('0')
        q2 = lambda v: v.quantize(Decimal('0.01'))

        return Response({
            'spent':         q2(spent),                    # потрачено (приходы)
            'cost_of_sales': q2(cost_of_sales),            # прошло — себестоимость продаж
            'writeoffs':     q2(writeoffs),                # ручные списания (бой, порча)
            'revenue':       q2(revenue),                  # выручка по чекам
            'profit':        q2(revenue - cost_of_sales),  # заработано
            'discrepancy':   q2(discrepancy),              # минус = недостача
            'discrepancy_rows': sorted(
                ({**r, 'quantity': r['quantity'], 'value': q2(r['value'])} for r in disc_rows.values()),
                key=lambda r: r['value'],
            ),
        })


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