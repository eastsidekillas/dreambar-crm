from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Shift
from .serializers import ShiftSerializer


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

    def create(self, request, *args, **kwargs):
        """Идемпотентно: если открытая смена уже есть — возвращаем её, а не создаём вторую."""
        existing = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
        if existing:
            return Response(ShiftSerializer(existing).data, status=status.HTTP_200_OK)
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            # Гонка двух устройств: сработал констрейнт only_one_open_shift
            existing = Shift.objects.filter(is_open=True).order_by('-opened_at').first()
            if existing:
                return Response(ShiftSerializer(existing).data, status=status.HTTP_200_OK)
            raise

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
        shift.is_open = False
        shift.closed_at = timezone.now()
        shift.save()
        try:
            from apps.printers.services import printing
            printing.print_shift_reports(shift)
        except Exception:
            pass
        return Response(ShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)
        if Shift.objects.filter(is_open=True).exists():
            return Response({'detail': 'Уже есть открытая смена.'}, status=status.HTTP_400_BAD_REQUEST)
        shift = self.get_object()
        shift.is_open = True
        shift.closed_at = None
        shift.save()
        return Response(ShiftSerializer(shift).data)
