import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export const API_BASE = environment.apiBase;

export interface Paginated<T> {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
}

/** DRF returns either a plain array (custom actions) or {count, results:[]} (list views). */
export function unpage<T>(obs: Observable<T[] | Paginated<T>>): Observable<T[]> {
  return obs.pipe(map((r: any) => Array.isArray(r) ? r : (r.results ?? [])));
}