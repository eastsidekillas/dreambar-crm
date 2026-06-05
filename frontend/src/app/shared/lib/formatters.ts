export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString('ru-RU', opts ?? { day: 'numeric', month: 'long' });
}

export function formatDateTime(dt: string | Date): string {
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

export function formatTime(dt: string | Date): string {
  return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(d: string | Date): string {
  return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatMoney(n: number | string): string {
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
}
