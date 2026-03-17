

# Seed de 10 Leads com Dados Aleatórios

## Contexto identificado
- **User ID:** `a3376ca3-d7c9-4140-bd10-cee295a0f3e8`
- **Organization:** `13a96fcb-faed-42f4-8a88-85c0a7103b98`
- **Funil:** "Funil de Vendas" (`8473568a-aa3f-4303-b693-06627d5d2968`)
- **Etapas:** Novo Lead, Qualificação, Proposta, Fechamento
- **Campo personalizado:** "Tipo de negócio" (select: Importador / Exportador)

## Plano

Executar uma migration SQL que insere:

1. **10 leads** com dados fictícios variados (nomes, emails, telefones, empresas brasileiras, valores, tags, fontes, prioridades), distribuídos entre as 4 etapas do funil.

2. **10 custom_field_values** vinculando cada lead ao campo "Tipo de negócio" alternando entre "Importador" e "Exportador".

### Dados dos leads (exemplo):

| Nome | Empresa | Etapa | Valor | Prioridade | Tipo Negócio |
|------|---------|-------|-------|------------|--------------|
| Carlos Silva | TechBR Ltda | Novo Lead | 15000 | medium | Importador |
| Ana Oliveira | Global Trade SA | Qualificação | 45000 | high | Exportador |
| Roberto Santos | Porto Logística | Proposta | 82000 | urgent | Importador |
| ... (7 mais) | ... | ... | ... | ... | ... |

### Arquivos
| Arquivo | Ação |
|---------|------|
| supabase/migrations/xxx.sql | Criar (INSERT de 10 leads + 10 custom_field_values) |

Nenhuma alteração de schema, apenas dados.

