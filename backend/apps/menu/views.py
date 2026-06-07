from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import MenuSection, MenuCategory, MenuItem
from .serializers import (
    MenuSectionSerializer, MenuCategorySerializer,
    MenuItemSerializer, MenuItemWriteSerializer,
)


def _is_staff_or_bartender(user):
    if user.is_staff:
        return True
    profile = getattr(user, 'profile', None)
    return profile and profile.role in ('bartender', 'admin')


class MenuSectionViewSet(viewsets.ModelViewSet):
    queryset = MenuSection.objects.all()
    serializer_class = MenuSectionSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset = MenuCategory.objects.select_related('section').all()
    serializer_class = MenuCategorySerializer
    filterset_fields = ['section', 'section__station_type', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.none()  # overridden in get_queryset; required by router
    filterset_fields = ['category', 'category__section__station_type', 'is_active']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemWriteSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = MenuItem.objects.select_related('category__section')
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'])
    def toggle_stock(self, request, pk=None):
        if not _is_staff_or_bartender(request.user):
            return Response({'detail': 'Недостаточно прав.'}, status=403)
        item = self.get_object()
        item.is_out_of_stock = not item.is_out_of_stock
        item.save(update_fields=['is_out_of_stock'])
        return Response({'id': item.id, 'is_out_of_stock': item.is_out_of_stock})

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Возвращает разделы → категории → позиции (3 уровня)."""
        sections = MenuSection.objects.prefetch_related(
            'categories__items'
        ).filter(is_active=True).order_by('sort_order')

        result = []
        for section in sections:
            for cat in section.categories.filter(is_active=True).order_by('sort_order'):
                items = cat.items.filter(is_active=True)
                result.append({
                    'id': cat.id,
                    'name': cat.name,
                    'section_id': section.id,
                    'section_name': section.name,
                    'station_type': section.station_type,
                    'print_station': cat.print_station,
                    'items': MenuItemSerializer(items, many=True).data,
                })
        return Response(result)