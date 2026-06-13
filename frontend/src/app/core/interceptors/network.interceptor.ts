import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, retry, timer, throwError } from 'rxjs';
import { NetworkService } from '../services/network.service';

/**
 * 1. Делает короткие повторы для идемпотентных GET при кратком сбое сети
 *    (флапающий Wi-Fi, перезапуск фронт-nginx во время деплоя).
 * 2. Поддерживает актуальный online/offline статус по факту ответов.
 *
 * Мутации (POST/PATCH/DELETE) НЕ повторяются автоматически — это задача
 * OutboxService (офлайн-очередь), иначе можно отправить дубль.
 */
export const networkInterceptor: HttpInterceptorFn = (req, next) => {
  const net = inject(NetworkService);
  const isGet = req.method === 'GET';

  return next(req).pipe(
    retry({
      count: isGet ? 2 : 0,
      delay: (err, n) => {
        if (err instanceof HttpErrorResponse && err.status === 0) return timer(400 * n);
        return throwError(() => err);
      },
    }),
    tap({
      next: (event) => {
        // Успешный ответ считаем «онлайном» только если есть сетевой интерфейс —
        // иначе это service worker отдал GET из кэша при офлайне.
        if (event instanceof HttpResponse && navigator.onLine) net.setOnline(true);
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 0) net.setOnline(false);
      },
    }),
  );
};