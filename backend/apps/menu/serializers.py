from rest_framework import serializers
from .models import MenuSection, MenuCategory, MenuItem


class MenuSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuSection
        fields = ['id', 'name', 'station_type', 'icon', 'sort_order', 'is_active']


class MenuCategorySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    station_type = serializers.CharField(source='section.station_type', read_only=True)

    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'section', 'section_name', 'station_type',
                  'print_station', 'is_active', 'sort_order']


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_type = serializers.CharField(source='category.section.station_type', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'is_out_of_stock', 'sort_order', 'category',
                  'category_name', 'category_type', 'print_station']


class MenuItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'is_out_of_stock', 'sort_order', 'category', 'print_station']