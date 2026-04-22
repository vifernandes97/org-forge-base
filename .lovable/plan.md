

# Melhorias visuais e UX da tela de Leads

Conjunto de refinamentos focados em hierarquia visual, densidade de informação, feedback de estado e fluidez de uso. Tudo dentro do design system atual (slate/zinc + blue-600), sem mudanças estruturais nas funcionalidades.

## 1. Header: agrupamento e hierarquia

Hoje o header empilha 5 elementos sem agrupamento (funil, view toggle, exportar, novo lead). Visualmente "achatado".

- **Mover seletor de funil para o topo da página, ao lado do título** com estilo de "breadcrumb interativo": `Leads / [▼ Funil de Vendas]` — funil deixa de competir com ações.
- **Agrupar ações secundárias** (Exportar, mais ações futuras) em um menu `⋯` (DropdownMenu) à direita, mantendo apenas o CTA primário (`+ Novo Lead`) com destaque sólido azul.
- **Toggle Kanban/Lista** vira um `ToggleGroup` segmentado mais slim (ícones com tooltip), encostado ao lado direito.
- Adicionar **contador de leads** ao lado do título (`Leads · 42`) para feedback imediato do total filtrado.

## 2. Tabs de status com indicador numérico

Tabs `Ativos / Ganhos / Arquivados` hoje são puro texto.

- Adicionar **badge com contagem** em cada tab (`Ativos 42`, `Ganhos 12`, `Arquivados 8`).
- Trocar a tab ativa por um sublinhado azul fino + texto em `font-medium`, removendo o background pesado padrão do shadcn — visual mais editorial e menos "botão".
- Aumentar levemente o spacing entre tabs (`gap-6`).

## 3. Filter Bar: menos ruído, mais contexto

- **Search**: remover a borda e usar fundo `bg-muted/50`, ícone à esquerda, placeholder mais curto (`"Buscar leads..."`). Largura responsiva: cresce até 380px.
- **Botão "Filtros"** vira um chip com bordas arredondadas (`rounded-full`); badge de contagem em vermelho/azul vivo só quando > 0.
- Quando filtros estão ativos, exibir **chips removíveis** abaixo da barra (`Etapa: Negociação ×`, `Prioridade: Alta ×`) em vez de só mostrar o número — feedback explícito do que está filtrado.
- Botões "Limpar" e "Salvar" agrupados num bloco à direita, separados por `Separator` vertical.

## 4. Coluna do Kanban: header mais informativo

Header atual: nome + count + valor (text-xs cinza). Pouco contraste e sem identidade visual.

- **Barra colorida superior** mais grossa (`borderTopWidth: 4`) em arco arredondado (`rounded-t-lg`), virando "etiqueta visual" da etapa.
- **Layout do header em 2 linhas**:
  - Linha 1: nome da etapa (`font-semibold text-sm`) + count em **pill cinza** (`bg-muted px-2 rounded-full text-xs`).
  - Linha 2: valor total formatado com ícone `DollarSign` discreto + ticket médio (`R$ 45k · ticket R$ 5.6k`).
- **Indicador de SLA na coluna**: se a coluna tem `sla_hours`, mostrar pequeno ícone `Clock` com tooltip "SLA: 24h"; se algum lead da coluna estourou SLA, ponto vermelho ao lado do count.

## 5. Cards do Kanban: refinamentos finos

- **Hover state** mais perceptível: além de `shadow-md`, adicionar leve `translate-y-[-1px]` e borda `border-primary/20` — feedback tátil.
- **Stage time relativo**: trocar texto cinza simples por `Clock` icon + texto, e quando passar de SLA, virar texto âmbar/vermelho com tooltip "Acima do SLA da etapa".
- **Avatar do responsável**: hoje fundo cinza padrão; gerar **cor consistente por hash do user_id** (paleta de 8 cores suaves) — facilita reconhecer responsável de relance.
- **Tags** (se existirem): renderizar até 2 tags como mini-pills no rodapé do card; "+N" se sobrar.
- **Indicador de prioridade discreto**: em vez da bolinha (que removemos), aplicar **borda esquerda colorida fina** (`border-l-2`) no card quando `priority === 'high' | 'urgent'` — sinaliza sem poluir.

## 6. Coluna scrolling e espaçamento

- Aumentar largura mínima da coluna de `280px` → `300px` para acomodar melhor as estrelas + WhatsApp + avatar.
- Reduzir `gap` entre colunas de `gap-4` → `gap-3` para caber mais coluna no viewport.
- **Sombra sutil de scroll horizontal** nos cantos do container quando há overflow (gradient mask), indicando que há mais colunas para os lados.

## 7. Empty states refinados

- Coluna vazia: em vez do espaço vazio, mostrar texto sutil centralizado `"Solte leads aqui"` + ícone `Inbox` com `opacity-30`. Aparece no estado normal e ganha destaque (background azul claro) quando há card sendo arrastado.
- Tela sem leads no funil: ilustração simples (ícone grande), título "Nenhum lead ainda", botão `+ Adicionar primeiro lead`.

## 8. Drag & Drop: feedback visual aprimorado

- Coluna alvo durante drag: além do `ring-2 ring-primary/50`, adicionar **fundo `bg-primary/5`** e leve scale nos cards já presentes.
- DragOverlay: rotação sutil de 2° (`rotate-2`) + sombra mais intensa para diferenciar de cards estáticos.

## 9. Loading states

- Trocar Skeleton genérico das colunas por **skeleton estruturado**: header da coluna + 3 cards-skeleton com mesmas proporções dos cards reais — reduz layout shift quando dados chegam.

## 10. Responsividade

- Em telas < `sm`, header colapsa: título + count na linha 1, ações em linha 2 com scroll horizontal.
- Filter bar em mobile: search ocupa 100% da largura; chips de filtros ativos em scroll horizontal.

## Arquivos afetados

| Arquivo | Mudanças |
|---|---|
| `src/pages/LeadsPage.tsx` | Reorganizar header (funil junto ao título, ações agrupadas, contador de leads, ToggleGroup), tabs com badges de contagem |
| `src/components/leads/filters/LeadFilterBar.tsx` | Search com bg-muted, botão filtros como chip arredondado, chips removíveis dos filtros ativos |
| `src/components/leads/kanban/KanbanColumn.tsx` | Header em 2 linhas com pill de count, ticket médio, indicador SLA, empty state, largura 300px |
| `src/components/leads/kanban/KanbanCard.tsx` | Hover refinado, ícone clock no tempo, cor amber se SLA estourado, avatar com cor por hash, tags no rodapé, border-l de prioridade |
| `src/components/leads/kanban/DragOverlayCard.tsx` | Rotação + sombra mais intensa |
| `src/components/leads/kanban/KanbanView.tsx` | Skeleton estruturado, gap de colunas reduzido, máscara de scroll lateral |

## Resultado

- Hierarquia visual clara: título > tabs > filtros > kanban.
- Feedback explícito em todos estados (filtros ativos, SLA, drag, loading, vazio).
- Cards mais informativos sem perder a estética minimalista atual.
- Densidade otimizada — mais colunas visíveis, mais informação por card sem sensação de lotação.

