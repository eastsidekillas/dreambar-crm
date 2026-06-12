import { HttpErrorResponse, HttpEventType, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, tap, throwError, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ConnectivityService } from '../services/connectivity.service';

/** Запрос дольше этого — считаем, что сервер не отвечает (локальная сеть). */
const REQUEST_TIMEOUT_MS = 20_000;

/** Эндпоинты логина: 401 здесь — неверные креды, а не протухший токен. */
const isLoginUrl = (url: string) => url.includes('/auth/token/') || url.includes('/auth/pin/');

/** Общий refresh на все одновременные 401 — токен обновляется один раз. */
let refresh$: Observable<string> | null = null;

const withToken = (req: HttpRequest<unknown>): HttpRequest<unknown> => {
  const token = localStorage.getItem('access_token');
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const connectivity = inject(ConnectivityService);

  const prepared = isLoginUrl(req.url) ? req : withToken(req);

  return next(prepared).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    tap(ev => { if (ev.type === HttpEventType.Response) connectivity.reportOnline(); }),
    catchError(err => {
      // Сетевые сбои (нет связи / сервер молчит) — для баннера «нет связи»
      if (err?.name === 'TimeoutError' || (err instanceof HttpErrorResponse && err.status === 0)) {
        connectivity.reportOffline();
        return throwError(() => err);
      }
      connectivity.reportOnline();

      const expired = err instanceof HttpErrorResponse && err.status === 401
        && !isLoginUrl(req.url) && !req.url.includes('/auth/token/refresh');
      if (!expired || !localStorage.getItem('refresh_token')) {
        return throwError(() => err);
      }

      // Access протух — обновляем и повторяем исходный запрос
      refresh$ ??= auth.refreshAccessToken().pipe(
        shareReplay(1),
        finalize(() => { refresh$ = null; }),
      );
      return refresh$.pipe(
        // Ошибка самого refresh (протух и он) — сессия кончилась, на PIN-экран
        catchError(() => {
          auth.logout();
          return throwError(() => err);
        }),
        switchMap(() => next(withToken(req)).pipe(timeout(REQUEST_TIMEOUT_MS))),
      );
    }),
  );
};