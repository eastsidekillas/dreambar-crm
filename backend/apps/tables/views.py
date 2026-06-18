from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions_matrix import HasPerm, Perm
from .models import Zone, Table
from .serializers import ZoneSerializer, TableSerializer, natural_key
from .utils import table_segments


def _cascade_table_rename(old_number: str, new_number: str):
    """Update open orders that reference old_number in table_number (handles merged e.g. '5+6')."""
    from apps.orders.models import Order
    for order in Order.objects.filter(status='open'):
        parts = table_segments(order.table_number)
        if old_number in parts:
            order.table_number = '+'.join(new_number if t == old_number else t for t in parts)
            order.save(update_fields=['table_number', 'updated_at'])


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.prefetch_related('tables').all()
    serializer_class = ZoneSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [HasPerm(Perm.TABLE_MANAGE)]


class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.select_related('zone').filter(is_active=True)
    serializer_class = TableSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [HasPerm(Perm.TABLE_MANAGE)]

    def get_queryset(self):
        qs = Table.objects.select_related('zone')
        if self.request.query_params.get('all'):
            return qs.all()
        return qs.filter(is_active=True)

    def list(self, request, *args, **kwargs):
        tables = sorted(
            self.filter_queryset(self.get_queryset()),
            key=lambda t: (t.zone.sort, t.zone.name, natural_key(t.number)),
        )
        page = self.paginate_queryset(tables)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(tables, many=True).data)

    def perform_update(self, serializer):
        old_number = serializer.instance.number
        serializer.save()
        new_number = serializer.instance.number
        if old_number != new_number:
            _cascade_table_rename(old_number, new_number)
