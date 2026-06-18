def table_segments(table_number):
    """Сегменты объединённого стола: «11+12» → ['11', '12']. Пустые отброшены.

    Единая точка разбора строки `table_number` (Order/Receipt). Если в будущем
    столы станут связью (M2M), менять разбор нужно будет только здесь и у вызовов.
    """
    return [s.strip() for s in (table_number or '').split('+') if s.strip()]