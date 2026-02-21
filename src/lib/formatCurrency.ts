export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
