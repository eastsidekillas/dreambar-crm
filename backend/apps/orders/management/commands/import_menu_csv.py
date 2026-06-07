"""
Синхронизирует меню с CSV-файлом:
  - обновляет цены существующих позиций
  - создаёт новые категории и позиции
  - НЕ удаляет ничего

Формат CSV (разделитель ;):
  Категория;Тип;Название;Объём/вес;Описание;Цена;Активна

Использование:
  python manage.py import_menu_csv /path/to/menu_2026-06-06.csv
"""

import csv
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError
from apps.menu.models import MenuSection, MenuCategory, MenuItem

STATION_MAP = {'bar': 'Бар', 'kitchen': 'Кухня', 'hookah': 'Кальян'}


class Command(BaseCommand):
    help = 'Импорт меню из CSV-файла (обновляет цены, добавляет новые позиции)'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Путь к CSV-файлу')

    def handle(self, *args, **options):
        path = options['csv_file']
        try:
            f = open(path, encoding='utf-8-sig')
        except FileNotFoundError:
            raise CommandError(f'Файл не найден: {path}')

        sections: dict[str, MenuSection] = {}
        for station, name in STATION_MAP.items():
            sec, _ = MenuSection.objects.get_or_create(
                station_type=station,
                defaults={'name': name, 'sort_order': list(STATION_MAP).index(station)},
            )
            sections[station] = sec

        categories: dict[tuple, MenuCategory] = {}

        created_cats = 0
        created_items = 0
        updated_items = 0
        skipped = 0

        reader = csv.DictReader(f, delimiter=';')
        for lineno, row in enumerate(reader, start=2):
            cat_name   = row.get('Категория', '').strip()
            station    = row.get('Тип', '').strip()
            name       = row.get('Название', '').strip()
            volume     = row.get('Объём/вес', '').strip()
            desc       = row.get('Описание', '').strip()
            price_raw  = row.get('Цена', '').strip()
            active_raw = row.get('Активна', 'Да').strip()

            if not cat_name or not name or station not in sections:
                self.stdout.write(self.style.WARNING(f'  строка {lineno}: пропущена ({row})'))
                skipped += 1
                continue

            try:
                price = Decimal(price_raw)
            except InvalidOperation:
                self.stdout.write(self.style.WARNING(f'  строка {lineno}: неверная цена «{price_raw}», пропускаю'))
                skipped += 1
                continue

            is_active = active_raw.lower() not in ('нет', 'no', 'false', '0')

            # ── Категория ────────────────────────────────────────────
            cat_key = (cat_name, station)
            if cat_key not in categories:
                sec = sections[station]
                # sort_order: следующий свободный в этой секции
                existing_max = MenuCategory.objects.filter(section=sec).count()
                cat, cat_created = MenuCategory.objects.get_or_create(
                    name=cat_name,
                    section=sec,
                    defaults={'sort_order': existing_max},
                )
                categories[cat_key] = cat
                if cat_created:
                    created_cats += 1
                    self.stdout.write(f'  + категория «{cat_name}»')
            else:
                cat = categories[cat_key]

            # ── Позиция ──────────────────────────────────────────────
            # Ключ уникальности: категория + название + объём
            try:
                item = MenuItem.objects.get(category=cat, name=name, volume=volume)
                changed = []
                if item.price != price:
                    changed.append(f'цена {item.price}→{price}')
                    item.price = price
                if item.description != desc and desc:
                    item.description = desc
                if item.is_active != is_active:
                    changed.append(f'активна={is_active}')
                    item.is_active = is_active
                if changed:
                    item.save(update_fields=['price', 'description', 'is_active'])
                    updated_items += 1
                    self.stdout.write(f'  ✎ {name} {volume}: {", ".join(changed)}')
            except MenuItem.DoesNotExist:
                max_sort = MenuItem.objects.filter(category=cat).count()
                MenuItem.objects.create(
                    category=cat,
                    name=name,
                    volume=volume,
                    description=desc,
                    price=price,
                    is_active=is_active,
                    sort_order=max_sort,
                )
                created_items += 1
                self.stdout.write(f'  + {name} {volume} — {price} ₽')

        f.close()
        self.stdout.write(self.style.SUCCESS(
            f'\nГотово: категорий +{created_cats}, '
            f'позиций +{created_items}, обновлено {updated_items}, пропущено {skipped}'
        ))