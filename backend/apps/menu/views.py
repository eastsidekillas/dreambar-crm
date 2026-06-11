from django.db.models import ProtectedError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import Menu, MenuSection, MenuCategory, MenuItem, ModifierGroup, Modifier, MenuItemModifierGroup
from .serializers import (
    MenuSerializer,
    MenuSectionSerializer, MenuCategorySerializer,
    MenuItemSerializer, MenuItemWriteSerializer,
    ModifierGroupSerializer, ModifierSerializer, MenuItemModifierGroupSerializer,
)

_PROTECTED_MSG = 'Нельзя удалить: позиция используется в заказах. Деактивируйте её (is_active=false).'


def _is_staff_or_bartender(user):
    if user.is_staff:
        return True
    profile = getattr(user, 'profile', None)
    return profile and profile.role in ('bartender', 'admin')


class MenuViewSet(viewsets.ModelViewSet):
    queryset         = Menu.objects.all()
    serializer_class = MenuSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'activate', 'duplicate']:
            return [IsAdminUser()]
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


class MenuSectionViewSet(viewsets.ModelViewSet):
    queryset         = MenuSection.objects.select_related('menu').all()
    serializer_class = MenuSectionSerializer
    filterset_fields = ['menu', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset         = MenuCategory.objects.select_related('section__menu').all()
    serializer_class = MenuCategorySerializer
    filterset_fields = ['section', 'section__station_type', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


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
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': _PROTECTED_MSG}, status=status.HTTP_409_CONFLICT)

    @action(detail=True, methods=['post'])
    def toggle_stock(self, request, pk=None):
        if not _is_staff_or_bartender(request.user):
            return Response({'detail': 'Недостаточно прав.'}, status=403)
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