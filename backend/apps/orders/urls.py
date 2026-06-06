from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views.shifts import ShiftViewSet
from .views.menu import MenuCategoryViewSet, MenuItemViewSet
from .views.orders import OrderViewSet, ReceiptViewSet
from .views.tickets import EntryTicketViewSet
from .views.employees import UserProfileListView, EmployeeActivityView, EmployeeOrdersView, EmployeeDetailView
from .views.kitchen import KitchenOrdersView, KitchenItemStatusView, KitchenOrderReadyView
from .views.agent import AgentJobsView, AgentJobAckView

router = DefaultRouter()
router.register('shifts',           ShiftViewSet)
router.register('menu/categories',  MenuCategoryViewSet)
router.register('menu/items',       MenuItemViewSet)
router.register('orders',           OrderViewSet)
router.register('receipts',         ReceiptViewSet)
router.register('tickets',          EntryTicketViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('employees/',                  UserProfileListView.as_view(),  name='employees'),
    path('employees/activity/',         EmployeeActivityView.as_view(), name='employee-activity'),
    path('employees/orders/',           EmployeeOrdersView.as_view(),   name='employee-orders'),
    path('employees/<int:user_id>/',    EmployeeDetailView.as_view(),   name='employee-detail'),
    path('kitchen/orders/',                              KitchenOrdersView.as_view(),      name='kitchen-orders'),
    path('kitchen/item/<int:item_id>/status/',           KitchenItemStatusView.as_view(),  name='kitchen-item-status'),
    path('kitchen/order/<int:order_id>/ready/',          KitchenOrderReadyView.as_view(),  name='kitchen-order-ready'),
    path('print/agent/jobs/',                            AgentJobsView.as_view(),          name='agent-jobs'),
    path('print/agent/jobs/<int:job_id>/ack/',           AgentJobAckView.as_view(),        name='agent-job-ack'),
]
