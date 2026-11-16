# Integração com o Orbi (reuniões)

Tarefa do CRM cujo tipo tem `action = 'orbi_meeting'` (hoje, Reunião) vira um
**pedido de reunião** no Orbi (https://orbi.neosoluti.com.br). O responsável
confirma lá (ajusta data, hora, workspace); o Orbi cria a reunião e avisa o
CRM, que conclui a tarefa. Recusar lá deixa a tarefa aberta, marcada.
O contrato do lado do Orbi está no `CLAUDE.md` do Orbi (§5) e no DECISOES de
2026-10-28 de lá.

## Configurar (uma vez por organização)

1. CRM → Configurações → **Orbi**: copiar a URL de retorno
   (`<crm>/api/orbi/retorno/<organization_id>`).
2. Orbi → Configurações → **Integrações da organização** (owner/admin): criar a
   integração com essa URL e um workspace padrão. O Orbi mostra uma vez a chave
   (`orbi_int_…`) e o segredo de assinatura (`orbi_whsec_…`).
3. CRM → Configurações → Orbi: colar os dois. O servidor testa a chave
   (GET de um pedido inexistente tem que dar 404) e guarda cifrado
   (`server/canais/cifra.ts`).

## Fluxo

- **Banco** (`db/66_integracao_orbi.sql`): `org_orbi_integrations` (credencial;
  o navegador só vê URL, fim da chave, estado), `tasks.external_*` (estado do
  envio) e `orbi_cancels`. O trigger `z_tasks_orbi_fila` decide:
  - tarefa nova de Reunião, com integração ligada → `queued`;
  - pendente editada (título, descrição, prazo, responsável, subtipo) → `queued`
    de novo (o reenvio atualiza o mesmo pedido: `externalId` = id da tarefa);
  - pendente concluída à mão, apagada ou que deixou de ser Reunião → cancela
    no Orbi (`orbi_cancels`) e marca `cancelled`;
  - mudança feita junto com `external_status` (envio, retorno, reenviar) não
    dispara nada.
- **Envio** (`server/orbi.ts`, intervalo de 15 s na API): prazo da tarefa vira
  data/hora no fuso `America/Sao_Paulo`, 60 min; vai o e-mail do responsável
  (`profiles.email`; sem conta no Orbi, cai em quem criou a integração lá),
  subtipo, descrição e contexto (empresa, contato principal, etapa, link do
  negócio). 4xx (fora 429) = `failed` na hora; rede/5xx/429 = novas tentativas
  (1, 5, 15, 60, 240, 480, 720 min; 8 no máximo). 401/403 grava `last_error`
  na integração.
- **Retorno** (`POST /api/orbi/retorno/:orgId`): confere
  `X-Orbi-Signature: sha256=<HMAC(segredo, "<X-Orbi-Timestamp>.<corpo>")>` e
  timestamp com até 5 min (`server/orbi-assinatura.ts`). Aceito → tarefa
  concluída, `external_ref_id` = id da série no Orbi, atividade "Reunião
  cadastrada no Orbi". Recusado → `rejected` com o motivo e atividade.
  Repetido é ignorado.
- **Tela**: selo na tarefa (`OrbiStatusBadge`): Enviando / Aguardando
  confirmação (link para o pedido) / No Orbi / Recusada / Falha (com
  Reenviar).

## Agendamento pela Bia (2026-11-15)

A Bia (Chatvolt, docs/WHATSAPP.md §19) oferece ao lead os horários livres de
**um tipo de reunião** do Orbi e marca o que ele aceitar. O contrato do lado
do Orbi está no `CLAUDE.md` de lá ("Agendamento pela integração") e no
DECISOES de 2026-11-15.

- **Configurar:** CRM → Configurações → Orbi → "3. Agendamento pela Bia": colar
  o link do tipo (`https://orbi…/agendar/<pessoa>/<tipo>`), que fica em
  `org_orbi_integrations.booking_link` (`db/70_agendamento_orbi.sql`). O tipo
  precisa estar ativo num workspace da mesma organização da chave; o link
  público pode estar desligado. Vazio = a Bia pede a demo como antes.
- **Horários:** `POST /api/agente/chatvolt/horarios` → Orbi
  `GET /api/integrations/inbound/booking-slots` (14 dias); o CRM escolhe até 4
  opções (`server/agente/agendamento.ts`, `escolherOpcoes`) e escreve em
  português ("quinta, 20/11, às 14h").
- **Marcar:** `POST /api/agente/chatvolt/agendar` → Orbi
  `POST /api/integrations/inbound/bookings` (`externalId`
  `crm-lead-<lead>-<instante>`: a Bia repetindo não duplica). A reserva **nasce
  confirmada** lá (escolha do dono: o lead já aceitou na conversa), com Meet
  quando o tipo pede e há Google. No CRM, a tarefa Reunião de demonstração
  entra **já** com `external_status = 'accepted'` (o trigger `z_tasks_orbi_fila`
  não reenvia), concluída como no retorno de um pedido aceito,
  `external_request_id` = reserva e `external_ref_id` = reunião; atividade
  "Demo marcada pela Bia (IA)", etapa Atendimento Humano (`moverEtapa`) e
  aviso. Um pedido de demo antigo ainda aberto é concluído, o que o cancela no
  Orbi.
- **Dados do lead na reunião** (`fichaDoLead`, desde 2026-11-16): nome e
  e-mail do contato principal do CRM (o e-mail que a Bia mandar vale primeiro;
  com e-mail, o lead recebe o convite do Google e a confirmação do Orbi) e, nas
  `notes` (descrição no Orbi e no Google, e na tarefa), a ficha: empresa,
  segmento, cidade, festas por mês, pessoas, controle atual, dor, objeção,
  preço informado, plano, nota, valor, etapa, origem/UTM, resumo da Bia e link
  do negócio. Campos do negócio primeiro; o que a Bia registrou completa.
- **Demo combinada por humano no Chatvolt:** vem pelo canal `chatvolt` (docs/WHATSAPP.md §20): a análise cria a tarefa Reunião e ela segue como pedido, a confirmar no Orbi.
- **Limites:** uma demo futura por negócio (trocar de horário passa por
  humano); cancelar ou remarcar no Orbi ainda **não** volta ao CRM.

## Diagnóstico

```sql
select id, title, external_status, external_error, external_attempts, external_next_at
  from tasks where external_status is not null order by updated_at desc limit 20;
select * from orbi_cancels;
select organization_id, enabled, last_error, last_ok_at, booking_link from org_orbi_integrations;
```
