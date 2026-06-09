from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ZoneViewSet, TableViewSet

router = DefaultRouter()
router.register('zones', ZoneViewSet)
router.register('', TableViewSet, basename='table')

urlpatterns = [
    path('', include(router.urls)),
]
