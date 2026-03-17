

# Trocar ícone de telefone por WhatsApp com link direto

## Mudanças em `src/components/leads/LeadDetailSheet.tsx`

### 1. Ícone
- Lucide não tem ícone nativo de WhatsApp. Usar um SVG inline pequeno do logo WhatsApp ou, mais simples, trocar `Phone` por `MessageCircle` (lucide) que remete a chat — **ou** criar um componente SVG do WhatsApp.
- Recomendo usar um SVG inline do WhatsApp para ficar claro visualmente.

### 2. Comportamento do ícone
- Tornar o ícone clicável (separado do InlineEditField de edição).
- Ao clicar no ícone, abrir `https://wa.me/{número_limpo}` em nova aba.
- Limpar o número removendo espaços, parênteses, hifens — manter apenas dígitos.
- Se não houver telefone, ícone fica desabilitado.

### 3. Implementação
- Envolver o ícone do campo phone em um `<a>` ou botão que abre o link wa.me.
- Manter o `InlineEditField` para edição do número, mas substituir o ícone estático por um botão clicável com o SVG do WhatsApp.
- Passar o ícone como um elemento clicável com `onClick` + `e.stopPropagation()` para não ativar a edição.

| Arquivo | Ação |
|---------|------|
| `LeadDetailSheet.tsx` | Substituir ícone Phone por WhatsApp SVG clicável com link wa.me |

