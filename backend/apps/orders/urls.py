from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShiftViewSet, MenuCategoryViewSet, MenuItemViewSet, OrderViewSet, EntryTicketViewSet,
    EmployeeActivityView, EmployeeOrdersView, UserProfileListView,
    KitchenOrdersView, KitchenItemStatusView, KitchenOrderReadyView,
)

router = DefaultRouter()
router.register('shifts', ShiftViewSet)
router.register('menu/categories', MenuCategoryViewSet)
router.register('menu/items', MenuItemViewSet)
router.register('orders', OrderViewSet)
router.register('tickets', EntryTicketViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('employees/', UserProfileListView.as_view(), name='employees'),
    path('employees/activity/', EmployeeActivityView.as_view(), name='employee-activity'),
    path('employees/orders/', EmployeeOrdersView.as_view(), name='employee-orders'),
    path('kitchen/orders/', KitchenOrdersView.as_view(), name='kitchen-orders'),
    path('kitchen/item/<int:item_id>/status/', KitchenItemStatusView.as_view(), name='kitchen-item-status'),
    path('kitchen/order/<int:order_id>/ready/', KitchenOrderReadyView.as_view(), name='kitchen-order-ready'),
]
