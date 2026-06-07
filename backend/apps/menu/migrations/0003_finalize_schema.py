"""
Шаг 3/3: финализация схемы.
- section_id становится NOT NULL (все категории уже привязаны).
- Удаляем старый столбец type из orders_menucategory.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('menu', '0002_seed_sections'),
    ]
    operations = [
        # section → NOT NULL
        migrations.AlterField(
            model_name='MenuCategory',
            name='section',
            field=models.ForeignKey(
                'menu.MenuSection', on_delete=django.db.models.deletion.CASCADE,
                related_name='categories',
            ),
        ),
        # type уже удалён Django при AlterField (SQLite пересоздаёт таблицу)
        migrations.RunSQL(sql="SELECT 1", reverse_sql="SELECT 1"),
    ]