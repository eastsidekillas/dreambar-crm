from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, ComponentViewSet, InventoryMovementViewSet, ConsumptionView

router = DefaultRouter()
router.register('products',   ProductViewSet,          basename='product')
router.register('components', ComponentViewSet,         basename='component')
router.register('movements',  InventoryMovementViewSet, basename='inventory-movement')

urlpatterns = [
    path('', include(router.urls)),
    path('consumption/', ConsumptionView.as_view(), name='inventory-consumption'),
]