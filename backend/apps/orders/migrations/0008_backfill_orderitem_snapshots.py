from django.db import migrations


def backfill(apps, schema_editor):
    """Заполнить снимки названия/объёма для уже существующих позиций из связанного меню."""
    OrderItem = apps.get_model('orders', 'OrderItem')
    for item in OrderItem.objects.select_related('menu_item').filter(menu_item_name=''):
        item.menu_item_name = item.menu_item.name
        item.menu_item_volume = item.menu_item.volume or ''
        item.save(update_fields=['menu_item_name', 'menu_item_volume'])


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_orderitem_menu_item_name_orderitem_menu_item_volume'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]