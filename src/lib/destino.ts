/**
 * Caminho interno para onde voltar depois do login (?next=). Só aceita caminhos
 * do próprio CRM ("/leads?lead=…"); URL externa, "//host" ou vazio caem no padrão.
 */
export function destinoSeguro(next: string | null, padrao = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return padrao;
  if (next.startsWith('/login')) return padrao;
  return next;
}
