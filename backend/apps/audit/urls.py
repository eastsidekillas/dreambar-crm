from django.urls import path
from .views import DeletedOrderItemListView

urlpatterns = [
    path('audit/deleted-items/', DeletedOrderItemListView.as_view(), name='audit-deleted-items'),
]