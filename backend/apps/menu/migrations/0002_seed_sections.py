"""
Шаг 2/3: data-миграция.
Создаёт три базовых раздела (Бар / Кухня / Кальян) и привязывает
существующие категории через старый столбец type.
"""
from django.db import migrations


def seed_sections_forward(apps, schema_editor):
    MenuSection = apps.get_model('menu', 'MenuSection')

    sections_map = {}
    for station_type, name, icon, order in [
        ('bar',     'Бар',    '🍸', 1),
        ('kitchen', 'Кухня',  '🍽', 2),
        ('hookah',  'Кальян', '💨', 3),
    ]:
        section = MenuSection.objects.create(
            name=name, station_type=station_type,
            icon=icon, sort_order=order,
        )
        sections_map[station_type] = section.id

    with schema_editor.connection.cursor() as cur:
        cur.execute("SELECT id, type FROM orders_menucategory")
        rows = cur.fetchall()

    with schema_editor.connection.cursor() as cur:
        for cat_id, cat_type in rows:
            section_id = sections_map.get(cat_type)
            if section_id:
                cur.execute(
                    "UPDATE orders_menucategory SET section_id = %s WHERE id = %s",
                    [section_id, cat_id],
                )


def seed_sections_reverse(apps, schema_editor):
    # Restore type column values from section, then delete sections
    with schema_editor.connection.cursor() as cur:
        cur.execute("""
            UPDATE orders_menucategory c
            SET type = s.station_type
            FROM menu_menusection s
            WHERE c.section_id = s.id
        """)
    apps.get_model('menu', 'MenuSection').objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('menu', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed_sections_forward, seed_sections_reverse),
    ]