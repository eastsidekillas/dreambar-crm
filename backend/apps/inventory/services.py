from decimal import Decimal

from django.db.models import F

from .models import Product, MenuItemComponent, InventoryMovement


def deduct_for_receipt(items, receipt, user=None):
    """
    Списывает компоненты со склада за оплаченные позиции.
    items — список/queryset OrderItem.
    Должна вызываться внутри transaction.atomic().
    """
    # menu_item_id → суммарное количество проданных позиций
    sold: dict[int, int] = {}
    # menu_item_id → первый OrderItem (для FK в движении)
    item_by_menu: dict[int, object] = {}
    for oi in items:
        mid = oi.menu_item_id
        sold[mid] = sold.get(mid, 0) + oi.quantity
        item_by_menu.setdefault(mid, oi)

    if not sold:
        return

    components = (
        MenuItemComponent.objects
        .filter(menu_item_id__in=sold.keys())
        .select_related('product')
    )

    # product_id → (total_deduction, order_item)
    deductions: dict[int, tuple] = {}
    for comp in components:
        pid = comp.product_id
        qty = comp.quantity * sold[comp.menu_item_id]
        if pid in deductions:
            deductions[pid] = (deductions[pid][0] + qty, deductions[pid][1])
        else:
            deductions[pid] = (qty, item_by_menu[comp.menu_item_id])

    if not deductions:
        return

    movements = []
    for pid, (qty, order_item) in deductions.items():
        Product.objects.filter(pk=pid).update(stock_quantity=F('stock_quantity') - qty)
        movements.append(InventoryMovement(
            product_id=pid,
            quantity=-qty,
            reason='sale',
            order_item=order_item,
            shift=receipt.shift,
            created_by=user,
        ))

    InventoryMovement.objects.bulk_create(movements)


def adjust_stock(product, delta, reason, user=None, note=''):
    """
    Ручная корректировка остатка.
    delta > 0 — приход, delta < 0 — списание.
    """
    Product.objects.filter(pk=product.pk).update(stock_quantity=F('stock_quantity') + delta)
    InventoryMovement.objects.create(
        product=product,
        quantity=delta,
        reason=reason,
        created_by=user,
        note=note,
    )