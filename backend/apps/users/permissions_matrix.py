"""
Матрица ролей и прав — ЕДИНСТВЕННЫЙ источник правды о том, что разрешено.

Идея: код проверяет не РОЛЬ, а ПРАВО (permission). Роль — это лишь ярлык,
которому сопоставлен набор прав. Добавить роль = добавить строку в ROLE_PERMISSIONS,
и она автоматически получает доступ ко всему, на что у неё есть право, и нигде больше.

────────────────────────────────────────────────────────────────────────────
Переход A → B без переписывания кода
────────────────────────────────────────────────────────────────────────────
Сценарий A (сейчас): наборы прав ролей заданы в коде (ROLE_PERMISSIONS ниже).
Сценарий B (потом):  наборы прав переедут в БД, админ редактирует их в UI.

Точкой перехода является РОВНО ОДНА функция — `permissions_for_role()`.
Чтобы перейти на B, нужно заменить только её тело (читать из модели Role
вместо словаря). Весь остальной код — permissions_for(), has_perm(),
DRF-классы, /auth/me — остаётся без изменений.

ВАЖНО: список самих прав (класс Perm) всегда живёт в коде, потому что каждое
право должно быть прикручено к конкретному endpoint'у. В сценарии B админ
комбинирует существующие права, но не изобретает новые.
"""
from __future__ import annotations


class Perm:
    """Каталог прав. Имя = '<домен>.<действие>'. Добавлять сюда новые при необходимости."""

    # Заказы
    ORDER_CREATE   = 'order.create'      # создавать/вести свои заказы
    ORDER_VIEW_ALL = 'order.view_all'    # видеть чужие заказы (не только свои)
    ORDER_EDIT_ANY = 'order.edit_any'    # править/удалять позиции в чужих заказах

    # Смены
    SHIFT_OPEN   = 'shift.open'
    SHIFT_CLOSE  = 'shift.close'
    SHIFT_REOPEN = 'shift.reopen'

    # Кухня / бар-станция (КДС)
    KITCHEN_VIEW   = 'kitchen.view'
    KITCHEN_UPDATE = 'kitchen.update_status'

    # Меню
    MENU_MANAGE       = 'menu.manage'           # CRUD меню/разделов/категорий/позиций/модификаторов
    MENU_TOGGLE_STOCK = 'menu.toggle_stock'     # пометить позицию «стоп»/вернуть (бармен из бара)

    # Столы и зоны (конфигурация зала)
    TABLE_MANAGE = 'table.manage'

    # Склад
    INVENTORY_MANAGE = 'inventory.manage'

    # Входные билеты
    TICKET_SELL   = 'ticket.sell'
    TICKET_MANAGE = 'ticket.manage'      # редактировать/удалять билеты

    # Брони
    RESERVATION_VIEW   = 'reservation.view'      # видеть брони (официанту для занятости столов)
    RESERVATION_MANAGE = 'reservation.manage'    # создавать/править/отменять/удалять брони

    # Персонал
    EMPLOYEE_MANAGE = 'employee.manage'

    # Аналитика
    ANALYTICS_FINANCE = 'analytics.finance'   # выручка, себестоимость, прогнозы

    # Принтеры
    PRINTER_MANAGE = 'printer.manage'


# Право-джокер: даёт доступ ко всему. Назначается админам (is_staff/superuser).
WILDCARD = '*'


# ─── Сценарий A: матрица в коде ────────────────────────────────────────────
# Значения подобраны так, чтобы отражать ТЕКУЩЕЕ предполагаемое поведение прода.
# Меняйте наборы под реальные правила бара — это и есть «настройка матрицы».
ROLE_PERMISSIONS: dict[str, set[str]] = {
    'admin': {WILDCARD},
    'waiter': {
        Perm.ORDER_CREATE,
        # смену официант не открывает и не закрывает — это делает бармен/гардероб/админ
        Perm.TICKET_SELL,
        Perm.RESERVATION_VIEW,   # столы официанта показывают занятость/инфо по броням
    },
    'bartender': {
        Perm.ORDER_CREATE,
        Perm.KITCHEN_VIEW, Perm.KITCHEN_UPDATE,
        Perm.SHIFT_OPEN, Perm.SHIFT_CLOSE,
        Perm.RESERVATION_VIEW, Perm.RESERVATION_MANAGE,
        Perm.MENU_TOGGLE_STOCK,   # бармен помечает позиции бара «стоп»
    },
    'kitchen': {
        Perm.KITCHEN_VIEW, Perm.KITCHEN_UPDATE,
    },
    'wardrobe': {
        Perm.TICKET_SELL,
    },
}


def permissions_for_role(role: str) -> set[str]:
    """Набор прав одной роли.

    ★ ЕДИНСТВЕННАЯ точка перехода A → B ★
    Сейчас (A): читаем из словаря в коде.
    Потом (B): заменить тело на чтение из БД, например:

        from apps.users.models import Role
        obj = Role.objects.filter(code=role).first()
        return set(obj.permissions) if obj else set()

    Никакой другой код менять не нужно.
    """
    return set(ROLE_PERMISSIONS.get(role, set()))


def permissions_for(user) -> set[str]:
    """Эффективный набор прав пользователя (объединение всех его ролей)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return set()
    # Админ Django — полный доступ, минуя матрицу.
    if user.is_staff or user.is_superuser:
        return {WILDCARD}
    profile = getattr(user, 'profile', None)
    if profile is None:
        return set()
    roles = {profile.role, *(profile.allowed_roles or [])}
    perms: set[str] = set()
    for r in roles:
        perms |= permissions_for_role(r)
    return perms


def has_perm(user, perm: str) -> bool:
    """Есть ли у пользователя право `perm` (с учётом джокера '*')."""
    perms = permissions_for(user)
    return WILDCARD in perms or perm in perms


# ─── DRF glue ──────────────────────────────────────────────────────────────
# Готово к подключению, но пока НЕ применяется ни в одном view — поведение прода
# не меняется. На этапе enforcement: permission_classes=[HasPerm(Perm.SHIFT_OPEN)]
# или, для разных action, через get_permissions().
from rest_framework.permissions import BasePermission  # noqa: E402


class HasPerm(BasePermission):
    """Пропускает, только если у пользователя есть требуемое право из матрицы.

    Заменяет россыпь IsAdminUser / IsKitchenStaff / `if not user.is_staff`.
    Использование:
        permission_classes = [HasPerm(Perm.MENU_MANAGE)]
    или по действиям:
        def get_permissions(self):
            need = {'reopen': Perm.SHIFT_REOPEN, 'create': Perm.SHIFT_OPEN}
            return [HasPerm(need.get(self.action, Perm.SHIFT_CLOSE))]
    """

    message = 'Недостаточно прав для этого действия.'

    def __init__(self, perm: str | None = None):
        self.perm = perm

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # perm может быть не задан, если класс указан без вызова — тогда только аутентификация.
        return self.perm is None or has_perm(user, self.perm)


def RequirePerm(perm: str):
    """Фабрика permission-КЛАССА для `permission_classes = [RequirePerm(Perm.X)]`.

    DRF сам инстанцирует классы из permission_classes без аргументов, поэтому туда
    нельзя передать готовый HasPerm(perm)-инстанс. Для get_permissions() (где список
    инстансов возвращается напрямую) используйте HasPerm(Perm.X).
    """
    class _RequirePerm(HasPerm):
        def __init__(self):
            super().__init__(perm)
    return _RequirePerm