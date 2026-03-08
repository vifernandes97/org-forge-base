

# Pipeline de Etapas Inline no Drawer — Estilo Bitrix

## Objetivo
Exibir todas as etapas do funil como uma barra de progresso horizontal clicável no topo do drawer do lead, permitindo mudar de etapa com um clique (estilo Bitrix CRM).

## Mudanças

### 1. Novo componente `src/components/leads/StagePipeline.tsx`
- Barra horizontal com todas as etapas do funil em sequência
- Cada etapa é um segmento clicável com a cor da etapa
- Etapa atual destacada (preenchida); etapas anteriores com cor mais suave; posteriores em cinza/outline
- Ao clicar em uma etapa, chama `onStageChange(stageId)`
- Visual: setas/chevrons entre etapas ou segmentos conectados (estilo pipeline Bitrix)
- Responsivo: em telas pequenas usa scroll horizontal

### 2. Atualizar `src/components/leads/LeadDetailSheet.tsx`
- Importar `useStages` para carregar as etapas do funil do lead
- Importar `useMoveLeadToStage` para mover o lead ao clicar
- Adicionar `<StagePipeline>` logo abaixo do header, antes do grid de 2 colunas
- Remover o badge de etapa atual do header (substituído pelo pipeline visual)
- Registrar atividade de `stage_change` ao mover

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/StagePipeline.tsx` | Novo — barra de etapas clicável |
| `src/components/leads/LeadDetailSheet.tsx` | Integrar pipeline + lógica de mudança de etapa |

