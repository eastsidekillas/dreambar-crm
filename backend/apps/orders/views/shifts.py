from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Shift
from ..serializers import ShiftSerializer
from ..services import printing


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

    def perform_create(self, serializer):
        serializer.save(opened_by=self.request.user)

    @action(detail=False, methods=['get'])
    def current(self, request):
        shift = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if not shift:
            return Response({'detail': 'Нет открытой смены.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        shift = self.get_object()
        if not shift.is_open:
            return Response({'detail': 'Смена уже закрыта.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        shift.is_open = False
        shift.closed_at = timezone.now()
        shift.save()
        try:
            printing.print_shift_reports(shift)
        except Exception:
            pass  # ошибка печати не блокирует закрытие смены
        return Response(ShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        shift = self.get_object()
        shift.is_open = True
        shift.closed_at = None
        shift.save()
        return Response(ShiftSerializer(shift).data)
