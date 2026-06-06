from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from ..models import MenuCategory, MenuItem
from ..serializers import MenuCategorySerializer, MenuItemSerializer, MenuItemWriteSerializer


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset = MenuCategory.objects.all()
    serializer_class = MenuCategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related('category').filter(is_active=True)
    filterset_fields = ['category', 'category__type', 'is_active']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemWriteSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = MenuItem.objects.select_related('category')
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        categories = MenuCategory.objects.prefetch_related('items').all()
        result = []
        for cat in categories:
            items = cat.items.filter(is_active=True)
            result.append({
                'id': cat.id,
                'name': cat.name,
                'type': cat.type,
                'items': MenuItemSerializer(items, many=True).data,
            })
        return Response(result)
