export const onlyDigits = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

/** Apply mask 00.000.000/0000-00 while typing. */
export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 5);
  if (d.length > 5) out += '.' + d.slice(5, 8);
  if (d.length > 8) out += '/' + d.slice(8, 12);
  if (d.length > 12) out += '-' + d.slice(12, 14);
  return out;
}

export function formatCnpj(v: string | null | undefined): string {
  const d = onlyDigits(v);
  return d.length === 14 ? maskCnpj(d) : d;
}

/** Validates CNPJ check digits. */
export function isValidCnpj(v: string | null | undefined): boolean {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
