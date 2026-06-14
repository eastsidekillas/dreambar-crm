from django.db.models import ProtectedError
from django.urls import path, include
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from apps.users.permissions_matrix import RequirePerm, Perm
from .views import MenuViewSet, MenuSectionViewSet, MenuCategoryViewSet, MenuItemViewSet
from .models import ModifierGroup, Modifier, MenuItemModifierGroup
from .serializers import ModifierGroupSerializer, ModifierSerializer, MenuItemModifierGroupSerializer

_PROTECTED_MSG = 'Нельзя удалить: модификатор используется в заказах. Деактивируйте его.'


class ModifierGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [RequirePerm(Perm.MENU_MANAGE)]
    queryset           = ModifierGroup.objects.prefetch_related('modifiers').all()
    serializer_class   = ModifierGroupSerializer


class ModifierViewSet(viewsets.ModelViewSet):
    permission_classes = [RequirePerm(Perm.MENU_MANAGE)]
    queryset           = Modifier.objects.select_related('group').all()
    serializer_class   = ModifierSerializer
    filterset_fields   = ['group', 'is_active']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': _PROTECTED_MSG}, status=status.HTTP_409_CONFLICT)


class MenuItemModifierGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [RequirePerm(Perm.MENU_MANAGE)]
    serializer_class   = MenuItemModifierGroupSerializer
    filterset_fields   = ['menu_item']

    def get_queryset(self):
        return MenuItemModifierGroup.objects.select_related(
            'modifier_group'
        ).prefetch_related('modifier_group__modifiers').all()


router = DefaultRouter()
# ВАЖНО: более специфичные пути (menu/X) должны стоять ДО короткого (menu),
# иначе ^menu/(?P<pk>[^/.]+)/$ перехватывает /menu/sections/, /menu/items/ и т.д.
router.register('menu/sections',          MenuSectionViewSet,           basename='menusection')
router.register('menu/categories',        MenuCategoryViewSet,          basename='menucategory')
router.register('menu/items',             MenuItemViewSet,              basename='menuitem')
router.register('menu/modifier-groups',   ModifierGroupViewSet,         basename='modifier-group')
router.register('menu/modifiers',         ModifierViewSet,              basename='modifier')
router.register('menu/item-modifiers',    MenuItemModifierGroupViewSet, basename='item-modifier')
router.register('menu',                   MenuViewSet,                  basename='menu')

urlpatterns = [
    path('', include(router.urls)),
]