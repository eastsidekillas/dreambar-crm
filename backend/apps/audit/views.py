from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import DeletedOrderItem
from .serializers import DeletedOrderItemSerializer


class DeletedOrderItemListView(ListAPIView):
    serializer_class = DeletedOrderItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['shift', 'deleted_by', 'kitchen_status']
    ordering_fields = ['deleted_at']
    ordering = ['-deleted_at']

    def get_queryset(self):
        qs = DeletedOrderItem.objects.select_related('deleted_by', 'order', 'shift')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(deleted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(deleted_at__date__lte=date_to)
        return qs