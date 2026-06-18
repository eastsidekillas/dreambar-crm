"""Детерминированные данные для e2e-тестов.

Используется ТОЛЬКО для изолированной e2e-БД (см. playwright e2e/backend.sh):
официант (PIN 1111) и кухня (PIN 2222), открытая смена, зоны Зал/VIP,
столы, меню с модификаторами, и VIP-бронь с оплаченным депозитом на сегодня.
Идемпотентна: чистит заказы/чеки/брони и пере-создаёт справочники.
"""
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.users.models import UserProfile
from apps.shifts.models import Shift
from apps.tables.models import Zone, Table
from apps.menu.models import (
    Menu, MenuSection, MenuCategory, MenuItem,
    ModifierGroup, Modifier, MenuItemModifierGroup,
)
from apps.reservations.models import Reservation
from apps.orders.models import Order
from apps.receipts.models import Receipt


def _user(username, role, pin):
    user, _ = User.objects.get_or_create(username=username, defaults={'is_active': True})
    user.is_active = True
    user.save(update_fields=['is_active'])
    prof, _ = UserProfile.objects.get_or_create(user=user)
    prof.role = role
    prof.allowed_roles = [role]
    prof.pin_hash = make_password(pin)
    prof.save()
    return user


class Command(BaseCommand):
    help = 'Сид детерминированных данных для e2e (изолированная БД).'

    def handle(self, *args, **opts):
        # ── Чистим транзакционные данные ──
        Receipt.objects.all().delete()
        Order.objects.all().delete()
        Reservation.objects.all().delete()

        # ── Пользователи ──
        waiter = _user('e2e_waiter', 'waiter', '1111')
        _user('e2e_kitchen', 'kitchen', '2222')

        # ── Открытая смена (одна) ──
        Shift.objects.filter(is_open=True).update(is_open=False, closed_at=timezone.now())
        Shift.objects.create(is_open=True, opened_by=waiter)

        # ── Зоны и столы ──
        Table.objects.all().delete()
        Zone.objects.all().delete()
        zal = Zone.objects.create(name='Зал', sort=0, requires_deposit=False)
        vip = Zone.objects.create(name='VIP', sort=1, requires_deposit=True, min_deposit=Decimal('3000'))
        Table.objects.create(zone=zal, number='Стол 1', seats=4)
        Table.objects.create(zone=zal, number='Стол 2', seats=4)
        Table.objects.create(zone=vip, number='VIP 1', seats=6)

        # ── Меню: Бар (Кола, Коктейль+модификаторы) и Кухня (Бургер+обязат. модификатор) ──
        Menu.objects.all().delete()
        menu = Menu.objects.create(name='E2E', is_active=True)

        bar = MenuSection.objects.create(menu=menu, name='Бар', station_type='bar', sort_order=0)
        bar_cat = MenuCategory.objects.create(section=bar, name='Напитки', sort_order=0)
        MenuItem.objects.create(category=bar_cat, name='Кола', price=Decimal('200'), is_active=True)
        cocktail = MenuItem.objects.create(category=bar_cat, name='Коктейль', price=Decimal('500'), is_active=True)

        addons = ModifierGroup.objects.create(name='Добавки', is_required=False, max_selections=2)
        Modifier.objects.create(group=addons, name='Лёд', price_delta=Decimal('0'))
        Modifier.objects.create(group=addons, name='Лимон', price_delta=Decimal('50'))
        MenuItemModifierGroup.objects.create(menu_item=cocktail, modifier_group=addons, sort_order=0)

        kit = MenuSection.objects.create(menu=menu, name='Кухня', station_type='kitchen', sort_order=1)
        kit_cat = MenuCategory.objects.create(section=kit, name='Горячее', sort_order=0)
        burger = MenuItem.objects.create(category=kit_cat, name='Бургер', price=Decimal('600'), is_active=True)

        roast = ModifierGroup.objects.create(name='Прожарка', is_required=True, max_selections=1)
        for n in ['Rare', 'Medium', 'Well done']:
            Modifier.objects.create(group=roast, name=n, price_delta=Decimal('0'))
        MenuItemModifierGroup.objects.create(menu_item=burger, modifier_group=roast, sort_order=0)

        # ── VIP-бронь с оплаченным депозитом на сегодня ──
        vip_table = Table.objects.get(number='VIP 1')
        Reservation.objects.create(
            name='E2E Депозит', phone='+70000000000', date=timezone.localdate(),
            time_start='20:00', guests_count=2, table=vip_table,
            deposit_amount=Decimal('3000'), deposit_method='cash', deposit_paid=True, status='confirmed',
        )

        self.stdout.write(self.style.SUCCESS('e2e seed готов: waiter PIN 1111, kitchen PIN 2222'))