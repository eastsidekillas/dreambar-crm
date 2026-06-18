from django.db import models
from django.contrib.auth.models import User


class DeletedOrderItem(models.Model):
    """Лог каждого удалённого из заказа элемента — для контроля злоупотреблений."""
    order         = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, related_name='deleted_items')
    shift         = models.ForeignKey('shifts.Shift', on_delete=models.SET_NULL, null=True, related_name='deleted_items')
    deleted_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='deleted_order_items')
    deleted_at    = models.DateTimeField(auto_now_add=True)

    table_number      = models.CharField(max_length=50, blank=True)
    menu_item_name    = models.CharField(max_length=200)
    menu_item_volume  = models.CharField(max_length=50, blank=True)
    quantity          = models.PositiveIntegerField()
    unit_price        = models.DecimalField(max_digits=10, decimal_places=2)
    kitchen_status    = models.CharField(max_length=10)

    class Meta:
        db_table = 'orders_deletedorderitem'
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


class IdempotencyKey(models.Model):
    """Ключ идемпотентности запроса. Повтор мутации с тем же ключом (ретрай
    офлайн-очереди при обрыве) возвращает СОХРАНЁННЫЙ ответ, не выполняя операцию
    заново — защита от дублей (напр. дубль открытого стола). См. IdempotencyMiddleware.

    Кэшируем только успешные ответы (2xx); при ошибке клейм удаляется, чтобы
    повтор честно выполнился снова."""
    key             = models.CharField(max_length=128, unique=True)
    method          = models.CharField(max_length=10)
    path            = models.CharField(max_length=255)
    completed       = models.BooleanField(default=False)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body   = models.TextField(blank=True)
    content_type    = models.CharField(max_length=100, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_idempotencykey'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['created_at'])]
        verbose_name = 'Ключ идемпотентности'
        verbose_name_plural = 'Ключи идемпотентности'

    def __str__(self):
        return f"{self.key} {self.method} {self.path} ({'done' if self.completed else 'pending'})"
