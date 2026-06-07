from rest_framework import serializers
from .models import EntryTicket


class EntryTicketSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EntryTicket
        fields = ['id', 'shift', 'bracelet_number', 'price', 'sold_at',
                  'created_by', 'created_by_name']
        read_only_fields = ['created_by', 'sold_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
