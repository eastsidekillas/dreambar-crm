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
from .models import (
    Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem,
    ReceiptImport, ReceiptItemMapping,
)
from .serializers import (
    ProductSerializer, ComponentSerializer, InventoryMovementSerializer,
    PurchaseOrderSerializer, PurchaseOrderItemSerializer, ReceiptImportSerializer,
)
from .services import adjust_stock
from . import codeqr


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

class ReceiptImportViewSet(viewsets.ModelViewSet):
    """Импорт кассовых чеков из магазина: QR → состав чека → закупка на склад."""
    permission_classes = [IsAdminUser]
    serializer_class   = ReceiptImportSerializer
    http_method_names  = ['get', 'post', 'delete']

    def get_queryset(self):
        return ReceiptImport.objects.select_related('purchase').all()

    def create(self, request, *args, **kwargs):
        """Принимает {qr} или {fn, fd, fp, total, ts} и отправляет чек на проверку."""
        qr = (request.data.get('qr') or '').strip()
        try:
            if qr:
                h = codeqr.add_qr(qr)
            else:
                required = ['fn', 'fd', 'fp', 'total', 'ts']
                if not all(request.data.get(k) for k in required):
                    return Response({'detail': 'Передайте qr или реквизиты чека (fn, fd, fp, total, ts).'}, status=400)
                h = codeqr.add_requisites(
                    request.data['fn'], request.data['fd'], request.data['fp'],
                    request.data['total'], request.data['ts'],
                )
        except codeqr.CodeQrError as e:
            return Response({'detail': str(e)}, status=400)

        # Один и тот же чек дважды не приходуем
        dup = ReceiptImport.objects.filter(hash=h).exclude(status='error').first()
        if dup:
            return Response({'detail': f'Этот чек уже загружен (№{dup.pk}, {dup.get_status_display()}).',
                             'existing_id': dup.pk}, status=409)

        imp = ReceiptImport.objects.create(qr=qr, hash=h, created_by=request.user)
        return Response(ReceiptImportSerializer(imp).data, status=201)

    @action(detail=True, methods=['post'])
    def poll(self, request, pk=None):
        """Опрашивает сервис проверки; когда чек готов — отдаёт позиции с подсказками сопоставления."""
        imp = self.get_object()
        if imp.status in ('wait', 'process'):
            try:
                data = codeqr.info(imp.hash)
            except codeqr.CodeQrError as e:
                return Response({'detail': str(e)}, status=502)
            imp.status = data.get('status') or 'wait'
            imp.error  = data.get('error') or ''
            if imp.status == 'done':
                result = data.get('result') or {}
                imp.result       = result
                imp.store        = (result.get('user') or '').replace('"', '').strip()
                imp.total        = Decimal(str(data.get('s', '0')).replace(' ', '') or 0)
                imp.purchased_at = str(data.get('t') or '')
            imp.save()

        return Response(self._detail_payload(imp))

    @action(detail=True, methods=['get'])
    def detail_lines(self, request, pk=None):
        """Позиции чека с подсказками сопоставления (для уже загруженного чека)."""
        return Response(self._detail_payload(self.get_object()))

    def _detail_payload(self, imp):
        payload = ReceiptImportSerializer(imp).data
        if imp.status in ('done', 'applied') and imp.result:
            names = [i.get('name', '') for i in imp.result.get('items', [])]
            mappings = {m.receipt_name: m.product_id
                        for m in ReceiptItemMapping.objects.filter(receipt_name__in=names)}
            payload['lines'] = [{
                'name':     i.get('name', ''),
                'quantity': i.get('quantity', 0),
                'price':    i.get('price', 0),
                'sum':      i.get('sum', 0),
                'product':  mappings.get(i.get('name', '')),
            } for i in imp.result.get('items', [])]
        return payload

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Оприходовать выбранные позиции чека: создаёт закупку и увеличивает остатки.

        body: {lines: [{name, quantity, price, product, remember}]}
        quantity — количество из чека (упаковок/кг), price — цена за единицу из чека.
        Остаток увеличивается на quantity × pack_size товара.
        """
        imp = self.get_object()
        if imp.status == 'applied':
            return Response({'detail': 'Чек уже оприходован.'}, status=400)
        if imp.status != 'done':
            return Response({'detail': 'Чек ещё не проверен.'}, status=400)

        lines = [l for l in request.data.get('lines', []) if l.get('product')]
        if not lines:
            return Response({'detail': 'Не выбрано ни одной позиции для оприходования.'}, status=400)

        products = Product.objects.in_bulk([l['product'] for l in lines])

        with transaction.atomic():
            order = PurchaseOrder.objects.create(
                status='received',
                store=imp.store or 'Магазин',
                created_by=request.user,
                received_at=timezone.now(),
                notes=f'Импорт чека №{imp.pk} от {imp.purchased_at}',
            )
            # Несколько строк чека могут указывать на один товар — объединяем
            merged = {}  # product_id -> {'qty_units': Decimal, 'cost': Decimal, 'packs': Decimal}
            for l in lines:
                p = products.get(l['product'])
                if not p:
                    continue
                packs = Decimal(str(l.get('quantity') or 0))
                price = Decimal(str(l.get('price') or 0))
                if packs <= 0:
                    continue
                m = merged.setdefault(p.pk, {'qty_units': Decimal(0), 'cost': Decimal(0), 'packs': Decimal(0)})
                m['qty_units'] += packs * p.pack_size
                m['cost']      += packs * price
                m['packs']     += packs

                if l.get('remember') and l.get('name'):
                    ReceiptItemMapping.objects.update_or_create(
                        receipt_name=l['name'][:300], defaults={'product': p},
                    )

            for pid, m in merged.items():
                p = products[pid]
                # цена за упаковку — средневзвешенная по строкам чека
                pack_price = (m['cost'] / m['packs']).quantize(Decimal('0.01')) if m['packs'] else Decimal(0)
                PurchaseOrderItem.objects.create(
                    order=order, product=p,
                    qty_ordered=m['qty_units'], qty_received=m['qty_units'],
                    unit_price=pack_price,
                )
                adjust_stock(p, delta=m['qty_units'], reason='manual_in',
                             user=request.user, note=f'Чек {imp.store} (импорт №{imp.pk})')
                p.purchase_price = pack_price
                p.save(update_fields=['purchase_price'])

            imp.status   = 'applied'
            imp.purchase = order
            imp.save(update_fields=['status', 'purchase'])

        return Response({
            'import': ReceiptImportSerializer(imp).data,
            'purchase': PurchaseOrderSerializer(order).data,
        })
