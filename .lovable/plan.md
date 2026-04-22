

# Filtros mais elegantes na tela de Leads

Repensar o painel de filtros para reduzir ruído visual, melhorar foco e dar feedback claro. Hoje, ao expandir, aparece um "muro" de pílulas heterogêneas (selects, ranges, datas) que confunde — vamos transformar em um **Popover organizado por categorias** com ações rápidas inline.

## Princípios

- **Toolbar enxuta** no estado de repouso: search + ações rápidas + botão "Filtros".
- **Filtros pesados em Popover** (não inline) — não empurra o Kanban.
- **Quick filters** acessíveis em 1 clique (Etapa, Responsável, Prioridade) sem abrir o painel completo.
- **Chips ativos** mantêm-se como hoje, mas com agrupamento e tipografia mais leve.

---

## 1. Toolbar redesenhada

```text
┌──────────────────────────────────────────────────────────────────┐
│ [🔍 Buscar...]  [Etapa▾] [Resp.▾] [Prioridade▾]  [⚙ Filtros·3]  │
│                                            [⭐ Salvos] [↻ Limpar]│
└──────────────────────────────────────────────────────────────────┘
```

- **Search** continua como hoje (bg-muted/50, sem borda).
- **Quick filter pills** (Etapa, Responsável, Prioridade): cada um abre um Popover com checklist; quando ativo, ganha bg azul claro + número (ex: `Etapa · 2`).
- **Botão "Filtros"**: abre Popover lateral com TODOS os filtros (incluindo os quick), organizado por seções.
- **Ações** (Salvos, Limpar) vão para o canto direito — só Limpar aparece se há filtros ativos. Salvar fica dentro do Popover principal de filtros.

## 2. Popover "Todos os filtros" (substitui Collapsible inline)

Largura fixa (~420px), aberto à direita do botão. Layout em **seções com headers**:

```text
┌─ Filtros ─────────────────────── [×] ┐
│                                       │
│ ▸ ESSENCIAIS                          │
│   Etapa            [Selecionar...  ▾] │
│   Responsável      [Selecionar...  ▾] │
│   Prioridade       [Selecionar...  ▾] │
│   Qualificação     [Selecionar...  ▾] │
│                                       │
│ ▸ ORIGEM & CLASSIFICAÇÃO              │
│   Fonte            [Selecionar...  ▾] │
│   Tags             [Selecionar...  ▾] │
│                                       │
│ ▸ TEMPO                               │
│   Criação          [De ──── Até    📅]│
│   Última atividade [De ──── Até    📅]│
│   Tempo na etapa   [Qualquer       ▾] │
│                                       │
│ ▸ VALOR                               │
│   Faixa            [R$ Min ── R$ Max] │
│                                       │
│ ▸ CAMPOS PERSONALIZADOS               │
│   (campos do usuário)                 │
│                                       │
├───────────────────────────────────────┤
│ [Limpar tudo]    [⭐ Salvar] [Aplicar]│
└───────────────────────────────────────┘
```

- **Seções colapsáveis** (`Collapsible` por seção); "Essenciais" abre por padrão.
- Cada filtro vira **linha**: label à esquerda em `text-xs text-muted-foreground`, controle full-width à direita — alinhamento limpo.
- Footer fixo com **3 ações**: Limpar tudo (ghost esquerda), Salvar (ghost), Aplicar (primário direita).
- Aplicar fecha o Popover; mudanças são staged dentro do popover (estado local) e só commitadas no Aplicar — evita re-render de listão a cada clique.

## 3. Chips ativos refinados

- **Agrupar por categoria** quando >5 chips: `Etapa: Negociação, Proposta` em vez de 2 chips separados.
- Chip ganha **ponto colorido** quando relevante (cor da etapa, cor da prioridade) antes do texto.
- Botão **"Limpar tudo"** aparece à direita da linha de chips se houver 3+ ativos.

## 4. Quick filter pills (novo)

Componente `QuickFilterPill` reutilizável:
- Trigger: pill arredondado com label + badge de contagem.
- Estado ativo: `bg-primary/10 text-primary border-primary/20`.
- Conteúdo: `Command` (busca + lista de checkboxes), com botão "Limpar" no rodapé.

## 5. Persistência e UX

- **Filtros salvos** ganham destaque: dropdown atual fica visível como botão `⭐` no toolbar, abrindo lista com nome do filtro + ações (aplicar / excluir).
- **Filtro aplicado vindo de "Salvos"**: mostrar pequeno indicador no toolbar `Aplicado: "Leads quentes" [×]` — clicar X reverte.

## 6. Responsividade

- Em `< md`: search ocupa 100%; quick pills ficam em scroll horizontal abaixo; botão "Filtros" abre `Sheet` (drawer lateral) em vez de Popover.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/filters/LeadFilterBar.tsx` | Reestruturar toolbar; remover Collapsible inline; adicionar quick pills; integrar novo Popover |
| `src/components/leads/filters/QuickFilterPill.tsx` *(novo)* | Componente reutilizável de pill com Popover de Command list |
| `src/components/leads/filters/AdvancedFiltersPopover.tsx` *(novo)* | Popover com seções, estado staged, footer de ações (Aplicar/Salvar/Limpar) |
| `src/components/leads/filters/SavedFiltersDropdown.tsx` | Trocar trigger por ícone `⭐` discreto + indicador de filtro salvo aplicado |
| `src/hooks/useLeadFilters.ts` | Expor método `applyMany(partial)` para commit em lote vindo do popover |

## Resultado

- Toolbar respira (1 linha em desktop padrão).
- Filtros frequentes acessíveis em 1 clique sem expandir um painel grande.
- Filtros avançados em estrutura organizada, fácil de escanear.
- Sem layout shift no Kanban ao abrir filtros.

