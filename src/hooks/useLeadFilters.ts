import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LeadFilters, LeadPriority, StageTimeFilter } from '@/types';

const ARRAY_KEYS: (keyof LeadFilters)[] = ['stage_ids', 'assigned_to', 'priorities', 'tags', 'sources'];
const NUMBER_KEYS: (keyof LeadFilters)[] = ['value_min', 'value_max'];
const STRING_KEYS: (keyof LeadFilters)[] = ['search', 'created_at_from', 'created_at_to', 'last_activity_from', 'last_activity_to', 'stage_time'];

function deserialize(params: URLSearchParams): LeadFilters {
  const filters: LeadFilters = {};
  for (const key of STRING_KEYS) {
    const v = params.get(key);
    if (v) (filters as any)[key] = v;
  }
  for (const key of NUMBER_KEYS) {
    const v = params.get(key);
    if (v) (filters as any)[key] = Number(v);
  }
  for (const key of ARRAY_KEYS) {
    const v = params.get(key);
    if (v) (filters as any)[key] = v.split(',');
  }
  const cf = params.get('custom_fields');
  if (cf) {
    try { filters.custom_fields = JSON.parse(cf); } catch {}
  }
  return filters;
}

function serialize(filters: LeadFilters): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of STRING_KEYS) {
    const v = (filters as any)[key];
    if (v) params[key] = v;
  }
  for (const key of NUMBER_KEYS) {
    const v = (filters as any)[key];
    if (v !== undefined && v !== null) params[key] = String(v);
  }
  for (const key of ARRAY_KEYS) {
    const v = (filters as any)[key] as string[] | undefined;
    if (v?.length) params[key] = v.join(',');
  }
  if (filters.custom_fields && Object.keys(filters.custom_fields).length > 0) {
    params.custom_fields = JSON.stringify(filters.custom_fields);
  }
  return params;
}

export function useLeadFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState<LeadFilters>(() => deserialize(searchParams));
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync filters to URL
  useEffect(() => {
    const serialized = serialize(filters);
    // Preserve non-filter params (like funnel, view)
    const newParams = new URLSearchParams(searchParams);
    // Remove old filter params
    [...STRING_KEYS, ...NUMBER_KEYS, ...ARRAY_KEYS, 'custom_fields'].forEach(k => newParams.delete(k));
    // Set new filter params
    Object.entries(serialized).forEach(([k, v]) => newParams.set(k, v));
    setSearchParams(newParams, { replace: true });
  }, [filters]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFiltersState(prev => {
        const next = { ...prev };
        if (value) next.search = value; else delete next.search;
        return next;
      });
    }, 300);
  }, []);

  const setFilter = useCallback(<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => {
    if (key === 'search') {
      handleSearchChange(value as string);
      return;
    }
    setFiltersState(prev => {
      const next = { ...prev };
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, [handleSearchChange]);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setSearchInput('');
  }, []);

  const applyFilters = useCallback((newFilters: LeadFilters) => {
    setFiltersState(newFilters);
    setSearchInput(newFilters.search || '');
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.stage_ids?.length) count++;
    if (filters.assigned_to?.length) count++;
    if (filters.priorities?.length) count++;
    if (filters.tags?.length) count++;
    if (filters.sources?.length) count++;
    if (filters.value_min !== undefined || filters.value_max !== undefined) count++;
    if (filters.created_at_from || filters.created_at_to) count++;
    if (filters.last_activity_from || filters.last_activity_to) count++;
    if (filters.stage_time) count++;
    if (filters.custom_fields && Object.keys(filters.custom_fields).length > 0) count += Object.keys(filters.custom_fields).length;
    return count;
  }, [filters]);

  return { filters, searchInput, setFilter, clearFilters, applyFilters, activeFilterCount };
}
