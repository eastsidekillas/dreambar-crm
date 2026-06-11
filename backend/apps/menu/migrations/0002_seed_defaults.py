"""
Сиды для чистой базы: «Основное меню» и три базовых раздела (Бар / Кухня / Кальян).
"""
from django.db import migrations


def seed_defaults(apps, schema_editor):
    Menu = apps.get_model('menu', 'Menu')
    MenuSection = apps.get_model('menu', 'MenuSection')

    if Menu.objects.exists():
        return

    menu = Menu.objects.create(name='Основное меню', is_active=True)
    for station_type, name, icon, order in [
        ('bar',     'Бар',    '🍸', 1),
        ('kitchen', 'Кухня',  '🍽', 2),
        ('hookah',  'Кальян', '💨', 3),
    ]:
        MenuSection.objects.create(
            menu=menu, name=name, station_type=station_type,
            icon=icon, sort_order=order,
        )


def unseed_defaults(apps, schema_editor):
    apps.get_model('menu', 'MenuSection').objects.all().delete()
    apps.get_model('menu', 'Menu').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_defaults, unseed_defaults),
    ]
