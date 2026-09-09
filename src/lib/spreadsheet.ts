import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type SheetRow = Record<string, string>;

export interface ParsedSheet {
  headers: string[];
  rows: SheetRow[];
}

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function normalizeRows(raw: unknown[][]): ParsedSheet {
  const headerRow = (raw[0] || []).map(cleanCell);
  const headers = headerRow.filter(h => h !== '');
  const rows: SheetRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i] || [];
    const row: SheetRow = {};
    let hasValue = false;
    headerRow.forEach((h, idx) => {
      if (!h) return;
      const val = cleanCell(line[idx]);
      row[h] = val;
      if (val !== '') hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  return { headers, rows };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return normalizeRows(result.data as unknown[][]);
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  return normalizeRows(raw as unknown[][]);
}

/** Native lead fields available as import targets */
export const NATIVE_TARGETS = [
  { key: 'company', label: 'Empresa' },
  { key: 'name', label: 'Nome do contato' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'value', label: 'Valor' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'qualification', label: 'Qualificação (1-5)' },
  { key: 'source', label: 'Fonte' },
  { key: 'tags', label: 'Tags' },
  { key: 'notes', label: 'Observações' },
  { key: 'company_instagram', label: 'Instagram' },
] as const;

export type NativeTargetKey = (typeof NATIVE_TARGETS)[number]['key'];

const ALIASES: Record<NativeTargetKey, string[]> = {
  company: ['empresa', 'company', 'razaosocial', 'razao', 'nomedaempresa', 'companhia', 'negocio', 'oportunidade'],
  name: ['nome', 'name', 'contato', 'nomecontato', 'nomedocontato', 'cliente', 'fullname', 'nomecompleto', 'lead'],
  email: ['email', 'e-mail', 'mail', 'emailcontato'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'whats', 'fone', 'tel', 'numero'],
  value: ['valor', 'value', 'ticket', 'preco', 'amount', 'valorestimado'],
  priority: ['prioridade', 'priority'],
  qualification: ['qualificacao', 'qualification', 'nota', 'score', 'estrelas'],
  source: ['fonte', 'source', 'origem', 'canal'],
  tags: ['tags', 'etiquetas', 'marcadores'],
  notes: ['observacoes', 'observacao', 'notas', 'notes', 'obs', 'comentarios', 'descricao'],
  company_instagram: ['instagram', 'insta', 'companyinstagram', 'instagramempresa'],
};

export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Suggest mapping: header -> target key ('' = ignore, 'cf:<id>' = custom field) */
export function guessMapping(
  headers: string[],
  customFields: { id: string; field_name: string; field_label: string }[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const key = normalizeKey(header);
    let target = '';
    for (const [targetKey, aliases] of Object.entries(ALIASES) as [NativeTargetKey, string[]][]) {
      if (used.has(targetKey)) continue;
      if (aliases.some(a => normalizeKey(a) === key)) {
        target = targetKey;
        break;
      }
    }
    if (!target) {
      const cf = customFields.find(
        f => normalizeKey(f.field_name) === key || normalizeKey(f.field_label) === key
      );
      if (cf && !used.has(`cf:${cf.id}`)) target = `cf:${cf.id}`;
    }
    if (target) used.add(target);
    mapping[header] = target;
  }
  return mapping;
}

export function parseSheetNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d,.-]/g, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_MAP: Record<string, string> = {
  baixa: 'low',
  media: 'medium',
  normal: 'medium',
  alta: 'high',
  urgente: 'urgent',
};

export function normalizePriority(raw: string): string {
  const key = normalizeKey(raw);
  if (!key) return 'medium';
  if (PRIORITIES.includes(key)) return key;
  return PRIORITY_MAP[key] || 'medium';
}

export function parseTags(raw: string): string[] {
  return (raw || '')
    .split(/[;,|]/)
    .map(t => t.trim())
    .filter(Boolean);
}
