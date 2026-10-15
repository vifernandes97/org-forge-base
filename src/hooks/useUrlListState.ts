import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List state (filters, sort, page) kept in the URL so links can be shared.
 * Arrays are comma-separated; booleans are "1".
 */
export function useUrlListState<F extends Record<string, any>>(schema: Record<keyof F, 'string' | 'array' | 'bool'>, defaultSort: string) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const f: Record<string, any> = {};
    for (const [k, t] of Object.entries(schema)) {
      const v = params.get(k);
      if (v == null || v === '') continue;
      f[k] = t === 'array' ? v.split(',').filter(Boolean) : t === 'bool' ? v === '1' : v;
    }
    return f as F;
  }, [params, schema]);

  const sort = params.get('sort') || defaultSort;
  const dir = (params.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const page = Math.max(0, Number(params.get('page') || 0));

  const update = useCallback((mut: (p: URLSearchParams) => void) => {
    setParams(prev => { const p = new URLSearchParams(prev); mut(p); return p; }, { replace: true });
  }, [setParams]);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K] | undefined) => {
    update(p => {
      const k = key as string;
      if (value == null || value === '' || value === false || (Array.isArray(value) && !value.length)) p.delete(k);
      else p.set(k, Array.isArray(value) ? value.join(',') : value === true ? '1' : String(value));
      p.delete('page');
    });
  }, [update]);

  const clearFilters = useCallback(() => update(p => { for (const k of Object.keys(schema)) p.delete(k); p.delete('page'); }), [update, schema]);
  const setSort = useCallback((key: string) => update(p => {
    const same = (p.get('sort') || defaultSort) === key;
    p.set('sort', key);
    p.set('dir', same && p.get('dir') !== 'desc' ? 'desc' : 'asc');
    p.delete('page');
  }), [update, defaultSort]);
  const setPage = useCallback((n: number) => update(p => { if (n) p.set('page', String(n)); else p.delete('page'); }), [update]);
  const setParam = useCallback((k: string, v: string | null) => update(p => { if (v) p.set(k, v); else p.delete(k); }), [update]);

  const activeCount = Object.keys(filters).filter(k => k !== 'q').length;
  return { filters, sort, dir, page, setFilter, clearFilters, setSort, setPage, params, setParam, activeCount };
}
