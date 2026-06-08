# Dreambar App

## Задача: модуль «Поставщики»

**Папка для работы:** `backend/apps/inventory/`

Нужно добавить в систему возможность хранить список поставщиков и прикреплять их к заказам на закупку. Вся работа — редактирование 4 файлов и создание одного нового.

---

### Файл 1 — `models.py`

В начало файла, **перед классом `PurchaseOrder`**, добавь новый класс:

```python
class Supplier(models.Model):
    name      = models.CharField(max_length=200, verbose_name='Название')
    phone     = models.CharField(max_length=50, blank=True, verbose_name='Телефон')
    email     = models.EmailField(blank=True, verbose_name='Email')
    notes     = models.TextField(blank=True, verbose_name='Заметки')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Поставщик'
        verbose_name_plural = 'Поставщики'

    def __str__(self):
        return self.name
```

В классе `PurchaseOrder` добавь одно поле после строки с `notes =`:

```python
supplier = models.ForeignKey(
    'Supplier', on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='purchase_orders',
    verbose_name='Поставщик',
)
```

---

### Файл 2 — `migrations/0004_supplier.py` (новый файл)

Создай файл с таким содержимым:

```python
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_purchase_order'),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id',        models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',      models.CharField(max_length=200, verbose_name='Название')),
                ('phone',     models.CharField(blank=True, max_length=50, verbose_name='Телефон')),
                ('email',     models.EmailField(blank=True, verbose_name='Email')),
                ('notes',     models.TextField(blank=True, verbose_name='Заметки')),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['name'],
                'verbose_name': 'Поставщик',
                'verbose_name_plural': 'Поставщики',
            },
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='supplier',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_orders',
                to='inventory.supplier',
                verbose_name='Поставщик',
            ),
        ),
    ]
```

---

### Файл 3 — `serializers.py`

В первую строку (`from .models import ...`) добавь `Supplier` в список:

```python
from .models import Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem, Supplier
```

После последнего класса в файле добавь:

```python
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Supplier
        fields = ['id', 'name', 'phone', 'email', 'notes', 'is_active']
```

В классе `PurchaseOrderSerializer` добавь поле `supplier_name` рядом с `created_by_name`:

```python
supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
```

В строку `fields = [...]` того же класса добавь `'supplier'` и `'supplier_name'`:

```python
fields = ['id', 'status', 'status_label', 'created_by', 'created_by_name',
          'created_at', 'received_at', 'notes', 'supplier', 'supplier_name', 'total', 'items']
```

---

### Файл 4 — `views.py`

В строку `from .models import ...` добавь `Supplier`:

```python
from .models import Product, MenuItemComponent, InventoryMovement, PurchaseOrder, PurchaseOrderItem, Supplier
```

В строку `from .serializers import ...` добавь `SupplierSerializer`:

```python
from .serializers import (
    ProductSerializer, ComponentSerializer, InventoryMovementSerializer,
    PurchaseOrderSerializer, PurchaseOrderItemSerializer, SupplierSerializer,
)
```

В конец файла добавь:

```python
class SupplierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset           = Supplier.objects.all()
    serializer_class   = SupplierSerializer
```

---

### Файл 5 — `urls.py`

В строку `from .views import ...` добавь `SupplierViewSet`:

```python
from .views import (
    ProductViewSet, ComponentViewSet, InventoryMovementViewSet,
    ConsumptionView, PurchaseOrderViewSet, SupplierViewSet,
)
```

После остальных `router.register(...)` добавь:

```python
router.register('suppliers', SupplierViewSet, basename='supplier')
```
