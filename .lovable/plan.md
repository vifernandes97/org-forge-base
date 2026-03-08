

# Adicionar padding interno nas páginas

## Problema
O `<main>` no `MainLayout` não tem padding, então o conteúdo das páginas fica colado nas bordas.

## Solução
Adicionar `p-4 sm:p-6` no `<main>` do `MainLayout.tsx`. Isso aplica padding consistente em **todas** as páginas protegidas (Dashboard, Leads, Tarefas, Funis, Configurações) de uma só vez.

### Arquivo alterado
| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/MainLayout.tsx` | `<main className="flex-1">` → `<main className="flex-1 p-4 sm:p-6">` |

Apenas 1 linha alterada. Efeito global em todas as páginas dentro do layout.

