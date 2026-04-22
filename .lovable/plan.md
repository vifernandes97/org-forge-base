

# Sidebar com auto-collapse e expansão no hover

## Comportamento

A sidebar fica **colapsada por padrão** (modo `icon`, mostrando apenas ícones em ~3.5rem de largura). Quando o cursor entra na área da sidebar, ela **expande automaticamente** mostrando os labels. Ao sair com o cursor, **colapsa novamente** após um pequeno delay.

### Estados

| Estado | Largura | Conteúdo |
|---|---|---|
| Repouso (sem hover) | ~56px (icon mode) | Apenas ícones |
| Hover ativo | ~256px (expanded) | Ícones + labels + badges |

### Detalhes de UX

- **Delay de saída**: ~200ms para evitar colapso acidental quando o cursor passa rapidamente fora.
- **Sem delay de entrada**: expande imediatamente ao hover.
- **SidebarTrigger** continua funcionando para travar a sidebar em estado expandido (override manual).
- **Em mobile (`< md`)**: comportamento atual de offcanvas é mantido — auto-collapse só faz sentido em desktop.
- **Sobreposição vs push**: a sidebar continua "empurrando" o conteúdo (comportamento atual). Caso queira flutuar por cima, é um ajuste extra — manter push para não deslocar layout abruptamente.

## Implementação

### 1. `src/components/layout/AppSidebar.tsx`
- Importar `useSidebar` do `@/components/ui/sidebar` para acessar `setOpen` e `state`.
- Adicionar handlers `onMouseEnter` e `onMouseLeave` no elemento `<Sidebar>`.
- `onMouseEnter` → `setOpen(true)` imediatamente.
- `onMouseLeave` → `setTimeout(() => setOpen(false), 200)`; armazenar timeout em `useRef` para cancelar se o cursor voltar.
- Detectar mobile via `useIsMobile()` (`@/hooks/use-mobile`) e desabilitar o comportamento em mobile.

### 2. `src/components/layout/MainLayout.tsx`
- `<SidebarProvider defaultOpen={false}>` para que a sidebar inicie colapsada.

### 3. Transição suave
- O componente `Sidebar` do shadcn já tem transição CSS de largura embutida (`transition-[width]`); nenhuma mudança de CSS necessária.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Adicionar handlers de hover + timeout ref + integração com `useSidebar` e `useIsMobile` |
| `src/components/layout/MainLayout.tsx` | `SidebarProvider` com `defaultOpen={false}` |

## Resultado

- Mais espaço útil para o conteúdo principal por padrão.
- Acesso rápido à navegação completa sem clique — apenas aproximar o cursor.
- Mobile continua com o drawer tradicional (sem regressão).

