from rest_framework import serializers
from .models import Zone, Table


class TableSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'zone', 'zone_name', 'number', 'seats', 'is_active', 'note']


class ZoneSerializer(serializers.ModelSerializer):
    tables = TableSerializer(many=True, read_only=True)

    class Meta:
        model = Zone
        fields = ['id', 'name', 'color', 'sort', 'tables']
