from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views.orders import OrderViewSet, ReceiptViewSet
from .views.kitchen import KitchenOrdersView, KitchenItemStatusView, KitchenOrderReadyView

router = DefaultRouter()
router.register('orders',   OrderViewSet)
router.register('receipts', ReceiptViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('kitchen/orders/',                     KitchenOrdersView.as_view(),     name='kitchen-orders'),
    path('kitchen/item/<int:item_id>/status/',  KitchenItemStatusView.as_view(), name='kitchen-item-status'),
    path('kitchen/order/<int:order_id>/ready/', KitchenOrderReadyView.as_view(), name='kitchen-order-ready'),
]
