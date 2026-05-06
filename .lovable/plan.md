# Badge de notificação no ícone do Dock

Mostrar no ícone do app (Dock do macOS, quando instalado como PWA) o número de leads na **1ª etapa do funil "Comercial"**, atualizando a cada 30s.

## Como funciona

Usa a **Badging API** do navegador (`navigator.setAppBadge(n)` / `clearAppBadge()`), suportada no macOS por Safari 16.4+ e Chrome/Edge quando o app está instalado via "Adicionar ao Dock". O número aparece como bolinha vermelha no ícone, igual a Mail/Mensagens.

## Implementação

### 1. Novo hook `src/hooks/useAppBadge.ts`

- Recebe `organization.id` do `OrganizationContext`.
- Resolve uma vez o `stage_id` da 1ª etapa (menor `position`) do funil cujo `name = 'Comercial'` da org.
- A cada 30s (e ao voltar a aba para visível), executa:
  ```ts
  supabase.from('leads').select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('stage_id', stageId)
    .eq('status', 'open')
  ```
- Chama `navigator.setAppBadge(count)` quando >0, ou `clearAppBadge()` quando 0.
- Try/catch silencioso para navegadores sem suporte (não quebra nada).
- Limpa o badge ao desmontar / trocar de organização.

### 2. Ativar no `MainLayout.tsx`

Chamar `useAppBadge()` dentro do componente para que rode em todas as rotas autenticadas.

## Observações

- O badge **só aparece quando o app está instalado** (no seu caso, adicionado ao Dock). No Safari aberto em aba normal a API existe mas não pinta o ícone.
- Como o critério é "funil Comercial" pelo **nome**, se o funil for renomeado o badge para de funcionar até o nome voltar a ser "Comercial" — me avise se preferir fixar pelo `funnel_id` em uma tela de configuração.
- Se houver mais de um funil chamado "Comercial" na sua org, usa o mais antigo.

## Arquivos

- novo: `src/hooks/useAppBadge.ts`
- editado: `src/components/layout/MainLayout.tsx` (1 linha: `useAppBadge()`)
