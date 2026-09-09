import { differenceInHours } from 'date-fns';
import type { LeadFilters, StageTimeFilter } from '@/types';

/** Map of lead_id -> (field_definition_id -> value) */
export type CustomFieldValueMap = Record<string, Record<string, string | null>>;

export function buildCustomFieldValueMap(
  rows: { lead_id: string; field_definition_id: string; value: string | null }[]
): CustomFieldValueMap {
  const map: CustomFieldValueMap = {};
  for (const r of rows) {
    if (!map[r.lead_id]) map[r.lead_id] = {};
    map[r.lead_id][r.field_definition_id] = r.value;
  }
  return map;
}

export function matchesStageTime(lead: any, stageTime: StageTimeFilter, stages: any[]): boolean {
  const hours = differenceInHours(new Date(), new Date(lead.stage_entered_at));
  switch (stageTime) {
    case 'less_24h': return hours < 24;
    case '1_3_days': return hours >= 24 && hours < 72;
    case '3_7_days': return hours >= 72 && hours < 168;
    case 'more_7_days': return hours >= 168;
    case 'above_sla': {
      const stage = stages.find(s => s.id === lead.stage_id);
      return stage?.sla_hours ? hours > stage.sla_hours : false;
    }
    default: return true;
  }
}

function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

export function matchesCustomFields(
  lead: any,
  cfMap: CustomFieldValueMap | undefined,
  customFilters: Record<string, any> | undefined
): boolean {
  if (!customFilters) return true;
  const entries = Object.entries(customFilters).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
  );
  if (entries.length === 0) return true;
  const values = cfMap?.[lead.id] || {};
  return entries.every(([fieldId, expected]) => {
    const actual = values[fieldId];
    if (Array.isArray(expected)) {
      const actualParts = String(actual ?? '')
        .split(/[;,]/)
        .map(normalize)
        .filter(Boolean);
      return expected.some(e => actualParts.includes(normalize(e)));
    }
    if (typeof expected === 'boolean') {
      const truthy = ['true', '1', 'sim', 'yes'].includes(normalize(actual));
      return truthy === expected;
    }
    return normalize(actual).includes(normalize(expected));
  });
}

export function applyClientFilters<T extends { id: string }>(
  leads: T[],
  filters: LeadFilters | undefined,
  stages: any[],
  cfMap?: CustomFieldValueMap
): T[] {
  let result = leads || [];
  if (filters?.stage_time) {
    result = result.filter(l => matchesStageTime(l, filters.stage_time!, stages));
  }
  if (filters?.custom_fields) {
    result = result.filter(l => matchesCustomFields(l, cfMap, filters.custom_fields));
  }
  return result;
}
