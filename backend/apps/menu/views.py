from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions_matrix import HasPerm, Perm, has_perm
from .models import Menu, MenuSection, MenuCategory, MenuItem, ModifierGroup, Modifier, MenuItemModifierGroup
from .serializers import (
    MenuSerializer,
    MenuSectionSerializer, MenuCategorySerializer,
    MenuItemSerializer, MenuItemWriteSerializer,
    ModifierGroupSerializer, ModifierSerializer, MenuItemModifierGroupSerializer,
)

_PROTECTED_MSG = 'Нельзя удалить: позиция используется в заказах. Деактивируйте её (is_active=false).'


class MenuViewSet(viewsets.ModelViewSet):
    queryset         = Menu.objects.all()
    serializer_class = MenuSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'activate', 'duplicate',
                           'export', 'import_menu']:
            return [HasPerm(Perm.MENU_MANAGE)]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        menu = self.get_object()
        menu.activate()
        return Response(MenuSerializer(menu).data)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        source   = self.get_object()
        new_name = request.data.get('name', f'Копия: {source.name}')
        new_menu = Menu.objects.create(name=new_name, is_active=False)

        for section in source.sections.prefetch_related('categories__items').order_by('sort_order'):
            new_section = MenuSection.objects.create(
                menu=new_menu, name=section.name,
                station_type=section.station_type, icon=section.icon,
                sort_order=section.sort_order, is_active=section.is_active,
            )
            for cat in section.categories.order_by('sort_order'):
                new_cat = MenuCategory.objects.create(
                    section=new_section, name=cat.name,
                    print_station=cat.print_station,
                    sort_order=cat.sort_order, is_active=cat.is_active,
                )
                for item in cat.items.order_by('sort_order'):
                    MenuItem.objects.create(
                        category=new_cat, name=item.name, volume=item.volume,
                        description=item.description, price=item.price,
                        cost_price=item.cost_price, is_active=item.is_active,
                        is_out_of_stock=False,
                        sort_order=item.sort_order, print_station=item.print_station,
                    )
        return Response(MenuSerializer(new_menu).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """GET → полная структура меню для скачивания файлом."""
        menu = self.get_object()
        sections = []
        for section in menu.sections.prefetch_related('categories__items').order_by('sort_order'):
            categories = []
            for cat in section.categories.order_by('sort_order'):
                categories.append({
                    'name': cat.name, 'print_station': cat.print_station,
                    'sort_order': cat.sort_order, 'is_active': cat.is_active,
                    'items': [{
                        'name': i.name, 'volume': i.volume, 'description': i.description,
                        'price': str(i.price), 'cost_price': str(i.cost_price),
                        'sort_order': i.sort_order, 'is_active': i.is_active,
                        'print_station': i.print_station,
                    } for i in cat.items.order_by('sort_order')],
                })
            sections.append({
                'name': section.name, 'station_type': section.station_type, 'icon': section.icon,
                'sort_order': section.sort_order, 'is_active': section.is_active,
                'categories': categories,
            })
        return Response({
            'format': 'dreambar-menu', 'version': 1,
            'name': menu.name, 'sections': sections,
        })

    @action(detail=False, methods=['post'], url_path='import')
    @transaction.atomic
    def import_menu(self, request):
        """POST <json из export> → создаёт новое (неактивное) меню."""
        data = request.data
        if data.get('format') != 'dreambar-menu':
            return Response({'detail': 'Это не файл меню BAR DREAM.'}, status=status.HTTP_400_BAD_REQUEST)
        sections = data.get('sections')
        if not isinstance(sections, list):
            return Response({'detail': 'В файле нет разделов меню.'}, status=status.HTTP_400_BAD_REQUEST)

        def dec(v, default='0'):
            try:
                return Decimal(str(v if v is not None else default))
            except InvalidOperation:
                raise ValueError(f'некорректная цена: {v!r}')

        name = str(data.get('name') or 'Импортированное меню')[:100]
        if Menu.objects.filter(name=name).exists():
            name = f'{name} (импорт)'[:100]

        try:
            menu = Menu.objects.create(name=name, is_active=False)
            items_count = 0
            for s_idx, s in enumerate(sections):
                section = MenuSection.objects.create(
                    menu=menu, name=str(s.get('name') or f'Раздел {s_idx + 1}')[:100],
                    station_type=str(s.get('station_type') or 'bar')[:20],
                    icon=str(s.get('icon') or '')[:50],
                    sort_order=int(s.get('sort_order') or 0),
                    is_active=bool(s.get('is_active', True)),
                )
                for c_idx, c in enumerate(s.get('categories') or []):
                    cat = MenuCategory.objects.create(
                        section=section, name=str(c.get('name') or f'Категория {c_idx + 1}')[:100],
                        print_station=str(c.get('print_station') or '')[:20],
                        sort_order=int(c.get('sort_order') or 0),
                        is_active=bool(c.get('is_active', True)),
                    )
                    for i in c.get('items') or []:
                        if not i.get('name'):
                            continue
                        MenuItem.objects.create(
                            category=cat, name=str(i['name'])[:200],
                            volume=str(i.get('volume') or '')[:50],
                            description=str(i.get('description') or ''),
                            price=dec(i.get('price')),
                            cost_price=dec(i.get('cost_price')),
                            sort_order=int(i.get('sort_order') or 0),
                            is_active=bool(i.get('is_active', True)),
                            is_out_of_stock=False,
                            print_station=str(i.get('print_station') or '')[:20],
                        )
                        items_count += 1
        except (ValueError, TypeError, KeyError) as e:
            transaction.set_rollback(True)
            return Response({'detail': f'Файл повреждён: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        result = MenuSerializer(menu).data
        result['items_imported'] = items_count
        return Response(result, status=status.HTTP_201_CREATED)


class MenuSectionViewSet(viewsets.ModelViewSet):
    queryset         = MenuSection.objects.select_related('menu').all()
    serializer_class = MenuSectionSerializer
    filterset_fields = ['menu', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [HasPerm(Perm.MENU_MANAGE)]
        return [IsAuthenticated()]


def _reorder(model, ids, key):
    """Валидирует список id и проставляет sort_order по индексу. Возвращает Response."""
    if not isinstance(ids, list) or not ids or not all(isinstance(i, int) for i in ids):
        return Response({'detail': f'{key} — непустой список id.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(ids) != len(set(ids)):
        return Response({'detail': f'{key} содержит дубликаты.'}, status=status.HTTP_400_BAD_REQUEST)

    objs = {o.pk: o for o in model.objects.filter(pk__in=ids)}
    missing = [i for i in ids if i not in objs]
    if missing:
        return Response({'detail': f'Не найдены: {missing}'}, status=status.HTTP_400_BAD_REQUEST)

    # Шаг 10 — чтобы между записями оставалось место для будущих вставок
    for idx, pk in enumerate(ids):
        objs[pk].sort_order = (idx + 1) * 10
    model.objects.bulk_update(objs.values(), ['sort_order'])
    return Response({'updated': len(ids)})


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset         = MenuCategory.objects.select_related('section__menu').all()
    serializer_class = MenuCategorySerializer
    filterset_fields = ['section', 'section__station_type', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'reorder']:
            return [HasPerm(Perm.MENU_MANAGE)]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """POST {category_ids: [..]} — задаёт порядок категорий: sort_order по индексу в списке."""
        return _reorder(MenuCategory, request.data.get('category_ids'), 'category_ids')


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset       = MenuItem.objects.none()
    filterset_fields = ['category', 'category__section__station_type', 'is_active']
    search_fields  = ['name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemWriteSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = MenuItem.objects.select_related('category__section__menu')
        if not has_perm(self.request.user, Perm.MENU_MANAGE):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'reorder']:
            return [HasPerm(Perm.MENU_MANAGE)]
        if self.action == 'toggle_stock':
            return [HasPerm(Perm.MENU_TOGGLE_STOCK)]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': _PROTECTED_MSG}, status=status.HTTP_409_CONFLICT)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """POST {item_ids: [..]} — задаёт порядок позиций: sort_order по индексу в списке."""
        return _reorder(MenuItem, request.data.get('item_ids'), 'item_ids')

    @action(detail=True, methods=['post'])
    def toggle_stock(self, request, pk=None):
        # Доступ ограничен HasPerm(MENU_TOGGLE_STOCK) в get_permissions() — бармен и админ.
        item = self.get_object()
        item.is_out_of_stock = not item.is_out_of_stock
        item.save(update_fields=['is_out_of_stock'])
        return Response({'id': item.id, 'is_out_of_stock': item.is_out_of_stock})

    @action(detail=True, methods=['get'])
    def modifier_groups(self, request, pk=None):
        item = self.get_object()
        qs   = MenuItemModifierGroup.objects.filter(menu_item=item).select_related(
            'modifier_group'
        ).prefetch_related('modifier_group__modifiers')
        return Response(MenuItemModifierGroupSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        menu_id = request.query_params.get('menu')
        if menu_id:
            sections_qs = MenuSection.objects.filter(menu_id=menu_id, is_active=True)
        else:
            active_menu = Menu.objects.filter(is_active=True).first()
            if not active_menu:
                return Response([])
            sections_qs = active_menu.sections.filter(is_active=True)

        sections = sections_qs.prefetch_related('categories__items').order_by('sort_order')

        result = []
        for section in sections:
            for cat in section.categories.filter(is_active=True).order_by('sort_order'):
                items = cat.items.filter(is_active=True)
                result.append({
                    'id':           cat.id,
                    'name':         cat.name,
                    'section_id':   section.id,
                    'section_name': section.name,
                    'station_type': section.station_type,
                    'print_station': cat.print_station,
                    'items':        MenuItemSerializer(items, many=True).data,
                })
        return Response(result)