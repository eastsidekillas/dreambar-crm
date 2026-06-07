from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EntryTicketViewSet

router = DefaultRouter()
router.register('tickets', EntryTicketViewSet)

urlpatterns = [path('', include(router.urls))]
