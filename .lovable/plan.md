# Reentrada de negócio existente volta para a etapa inicial

## Situação atual (verificada)

Na função de webhook de entrada, quando um negócio já existe (encontrado pelo e-mail) e a estratégia é "atualizar":
- os dados são atualizados (nome, e-mail, telefone, empresa, valor, tags, campos personalizados);
- a etapa **não** é alterada — o negócio permanece onde estava no funil;
- negócios arquivados ou marcados como ganhos continuam nesse estado, ou seja, uma nova entrada não os traz de volta ao fluxo ativo.

## O que será feito

Quando uma nova entrada corresponder a um negócio já existente (estratégia "atualizar"):

1. Mover o negócio para a **primeira etapa do funil configurado no webhook** (etapa de novo negócio), reiniciando o tempo na etapa.
2. Se estiver arquivado, desarquivar: limpar data e motivo de arquivamento e voltar o status para "em andamento".
3. Se estiver marcado como ganho, voltar o status para "em andamento".
4. Registrar na linha do tempo do negócio uma atividade de "reentrada" informando a etapa de origem e a volta para a etapa inicial, além das alterações de campos.
5. O registro de log do webhook continua marcando a ação como "atualizado", agora incluindo a mudança de etapa entre as alterações.

Isso mantém o histórico e as atividades do negócio original (sem duplicar o registro) e faz com que ele reapareça no topo do funil.

## Observações

- A identificação de duplicado continua por **e-mail**. Se quiser também considerar telefone, posso incluir — diga e ajusto.
- A estratégia "ignorar" e "criar novo" seguem inalteradas; o comportamento novo vale para webhooks com a estratégia "atualizar".

## Detalhes técnicos

- Arquivo: `supabase/functions/inbound-webhook/index.ts`, bloco `=== UPDATE strategy ===`.
- No `updateData`: definir `stage_id = firstStage.id` e `stage_entered_at = now()` quando `existingLead.stage_id !== firstStage.id`; definir `archived_at = null`, `archive_reason_id = null`, `status = 'open'` quando arquivado/ganho.
- Trigger existente de mudança de etapa continua disparando os webhooks de saída/automações normalmente.
- Nova atividade `stage_change` (ou `field_update` com descrição de reentrada) inserida em `lead_activities`.
- Redeploy da função após a alteração.
