from django.db import models
from django.contrib.auth.models import User


class DeletedOrderItem(models.Model):
    """Лог каждого удалённого из заказа элемента — для контроля злоупотреблений."""
    order         = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, related_name='deleted_items')
    shift         = models.ForeignKey('Shift', on_delete=models.SET_NULL, null=True, related_name='deleted_items')
    deleted_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='deleted_order_items')
    deleted_at    = models.DateTimeField(auto_now_add=True)

    # Снимок удалённой позиции
    table_number      = models.CharField(max_length=10, blank=True)
    menu_item_name    = models.CharField(max_length=200)
    menu_item_volume  = models.CharField(max_length=50, blank=True)
    quantity          = models.PositiveIntegerField()
    unit_price        = models.DecimalField(max_digits=10, decimal_places=2)
    kitchen_status    = models.CharField(max_length=10)  # new / cooking / ready

    class Meta:
        ordering = ['-deleted_at']
        verbose_name = 'Удалённая позиция'
        verbose_name_plural = 'Удалённые позиции'

    def __str__(self):
        return (
            f"{self.deleted_at:%d.%m %H:%M} | "
            f"{self.deleted_by} удалил «{self.menu_item_name}» "
            f"x{self.quantity} из заказа #{self.order_id}"
        )

    @property
    def subtotal(self):
        return self.unit_price * self.quantity