from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MenuSectionViewSet, MenuCategoryViewSet, MenuItemViewSet

router = DefaultRouter()
router.register('menu/sections',   MenuSectionViewSet)
router.register('menu/categories', MenuCategoryViewSet)
router.register('menu/items',      MenuItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]