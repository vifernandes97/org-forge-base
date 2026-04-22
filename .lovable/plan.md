

# Exibir labels dos campos no drawer do lead

## Problema
Hoje os campos do drawer (Email, Telefone, Empresa, Razão Social, Instagram, Valor, Responsável, Fonte, Prioridade, Qualificação e Campos Personalizados) mostram apenas o **ícone** + **valor**. A label só aparece como tooltip ao passar o mouse, o que dificulta identificar o campo de relance — especialmente quando está vazio ou quando o ícone é ambíguo.

## Solução
Renderizar a label como texto fixo **à esquerda do valor**, com largura fixa para alinhamento vertical limpo (estilo formulário Bitrix/Pipedrive).

### Layout proposto por linha
```text
[ícone]  Label do campo    Valor editável                    [✏️ on hover]
         ────────────────  ────────────────────────────────
         w-32 (128px)      flex-1
```

- Ícone permanece à esquerda (mantendo identificação visual rápida).
- **Label fixa** com `w-32 text-muted-foreground text-xs` ao lado do ícone.
- Valor (ou placeholder em itálico) ocupa o restante.
- Lápis de edição continua aparecendo no hover, à direita.
- Tooltip continua disponível para casos truncados, mas a label fica visível por padrão.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/InlineEditField.tsx` | Renderizar `props.label` como `<span>` fixo entre o ícone e o valor (em todos os modos: display, select, text/currency, textarea). Manter tooltip apenas para acessibilidade/truncamento. Ajustar grid para `[ícone] [label w-32] [valor flex-1]`. |
| `src/components/leads/LeadDetailSheet.tsx` | Garantir que o **título do lead** no header (linha 239) **não** receba label (passar `label={undefined}` — já está). E o campo **Notas** (linha 476) também sem label, pois já tem cabeçalho de seção próprio. |

### Casos especiais
- **Header (nome do lead)**: sem label, como hoje.
- **Notas (textarea)**: sem label inline, mantém cabeçalho "NOTAS" da seção.
- **Funil** (linha 404–409, leitura pura): adicionar label "Funil" no mesmo padrão para consistência visual.
- **Tempo na etapa** (linha 464–470, leitura pura): adicionar label "Há" ou manter como está (texto já é autoexplicativo); decisão: **manter como está**, pois a frase já contém contexto.

## Resultado
Cada linha do painel esquerdo do drawer mostrará:

```text
📧  Email           contato@exemplo.com
📱  Telefone        (11) 99999-0000
🏢  Empresa         Adicionar empresa...
🏷️  Fonte           Instagram
🏷️  Dor Principal   Adicionar dor principal...
```

Identificação imediata de cada campo, sem depender de hover.

