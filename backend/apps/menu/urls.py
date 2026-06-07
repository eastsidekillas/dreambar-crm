from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .views import MenuSectionViewSet, MenuCategoryViewSet, MenuItemViewSet
from .models import ModifierGroup, Modifier, MenuItemModifierGroup
from .serializers import ModifierGroupSerializer, ModifierSerializer, MenuItemModifierGroupSerializer


class ModifierGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset           = ModifierGroup.objects.prefetch_related('modifiers').all()
    serializer_class   = ModifierGroupSerializer


class ModifierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset           = Modifier.objects.select_related('group').all()
    serializer_class   = ModifierSerializer
    filterset_fields   = ['group', 'is_active']


class MenuItemModifierGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class   = MenuItemModifierGroupSerializer
    filterset_fields   = ['menu_item']

    def get_queryset(self):
        return MenuItemModifierGroup.objects.select_related(
            'modifier_group'
        ).prefetch_related('modifier_group__modifiers').all()


router = DefaultRouter()
router.register('menu/sections',          MenuSectionViewSet)
router.register('menu/categories',        MenuCategoryViewSet)
router.register('menu/items',             MenuItemViewSet)
router.register('menu/modifier-groups',   ModifierGroupViewSet,         basename='modifier-group')
router.register('menu/modifiers',         ModifierViewSet,              basename='modifier')
router.register('menu/item-modifiers',    MenuItemModifierGroupViewSet, basename='item-modifier')

urlpatterns = [
    path('', include(router.urls)),
]