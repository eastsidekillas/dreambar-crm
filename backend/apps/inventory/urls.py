from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, ComponentViewSet, InventoryMovementViewSet,
    ConsumptionView, StockReportView, PurchaseOrderViewSet, ReceiptImportViewSet,
)

router = DefaultRouter()
router.register('products',   ProductViewSet,          basename='product')
router.register('components', ComponentViewSet,         basename='component')
router.register('movements',  InventoryMovementViewSet, basename='inventory-movement')
router.register('purchases',  PurchaseOrderViewSet,     basename='purchase')
router.register('receipt-imports', ReceiptImportViewSet, basename='receipt-import')

urlpatterns = [
    path('', include(router.urls)),
    path('consumption/', ConsumptionView.as_view(), name='inventory-consumption'),
    path('report/',      StockReportView.as_view(),  name='inventory-report'),
]