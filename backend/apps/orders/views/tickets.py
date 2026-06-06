from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import EntryTicket, Shift
from ..serializers import EntryTicketSerializer


class EntryTicketViewSet(viewsets.ModelViewSet):
    queryset = EntryTicket.objects.select_related('created_by', 'shift')
    serializer_class = EntryTicketSerializer
    filterset_fields = ['shift']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        shift_id = request.data.get('shift')
        start    = request.data.get('start')
        end      = request.data.get('end')
        price    = request.data.get('price', 200)

        if not all([shift_id, start, end]):
            return Response({'detail': 'Укажите shift, start, end.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_n, end_n = int(start), int(end)
            shift = Shift.objects.get(pk=shift_id)
        except (ValueError, Shift.DoesNotExist):
            return Response({'detail': 'Некорректные данные.'}, status=status.HTTP_400_BAD_REQUEST)

        tickets = [
            EntryTicket(
                shift=shift,
                bracelet_number=str(i).zfill(6),
                price=price,
                created_by=request.user,
            )
            for i in range(start_n, end_n + 1)
        ]
        created = EntryTicket.objects.bulk_create(tickets, ignore_conflicts=True)
        return Response({'created': len(created)}, status=status.HTTP_201_CREATED)
