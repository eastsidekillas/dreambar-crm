from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Reservation
from .serializers import ReservationSerializer


class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    filterset_fields = ['date', 'status', 'table_number']

    def get_queryset(self):
        qs = Reservation.objects.select_related('created_by')
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        reservation = self.get_object()
        new_status = request.data.get('status')
        valid = [s[0] for s in Reservation.STATUS_CHOICES]
        if new_status not in valid:
            return Response({'detail': f'Допустимые статусы: {valid}'}, status=status.HTTP_400_BAD_REQUEST)
        reservation.status = new_status
        reservation.save(update_fields=['status'])
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=['post'])
    def mark_deposit(self, request, pk=None):
        reservation = self.get_object()
        reservation.deposit_paid = request.data.get('paid', True)
        reservation.save(update_fields=['deposit_paid'])
        return Response(ReservationSerializer(reservation).data)
