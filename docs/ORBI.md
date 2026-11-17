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

## Confirmação 3 h antes (2026-11-17)

Quem tem demo marcada no Orbi recebe no WhatsApp, 3 h antes, o template
`oni_confirmacao_demo_v3` ("Olá, {{1}}! … confirmar a demonstração às {{2}}",
botão "Entrar na demonstração" com o link do Meet), pelo número 0573 via
Chatvolt.

- **Job** (`server/agente/confirmacao-demo.ts`, fila `agenda.demo.confirmar`,
  cron de 5 min no worker): pega tarefas Reunião `external_status = 'accepted'`
  (subtipo Demonstração ou "demo" no título), com negócio aberto, que começam
  dentro de 3 h e ainda não têm linha em `demo_confirmations` (a trava, uma por
  tarefa). Demo marcada com menos de 3 h de antecedência sai no próximo ciclo
  (até 5 min depois); com menos de 15 min para começar não sai (`tarde_demais`).
- **Envio:** `POST https://api.chatvolt.ai/whatsapp/<phoneNumberId>/template-message`
  (Bearer `CHATVOLT_API_KEY`) com `var_1` = primeiro nome (sem nome que pareça
  nome: "tudo bem"), `var_2` = hora `HH:mm` em São Paulo e o botão de URL
  (`index: '0'`) com o código do Meet. O Chatvolt devolve a conversa e o id da
  mensagem, guardado em `demo_confirmations`; a análise da IA lê essa mensagem
  como "Equipe (mensagem automática)". Sucesso grava a nota "Confirmação da demo
  enviada no WhatsApp" no negócio.
- **Link:** `tasks.meeting_url` (`db/72`), gravado pelo `/agendar` da Bia a partir
  da reserva do Orbi. Demo que chega pelo retorno do Orbi (pedido confirmado por
  humano) **não traz o link** e fica `skipped` / `sem_link`; falta o Orbi mandar
  `meetingUrl` no retorno. Link que não é `https://meet.google.com/<código>` também
  fica sem confirmação.
- **Ligar:** desligado por padrão. No `secrets.env` do crm-app:
  `CONFIRMACAO_DEMO_ATIVA=1`, `CHATVOLT_WHATSAPP_PHONE_ID` (Chatvolt → agente →
  Implantar → WhatsApp Official → Phone Number ID; **não** é o telefone),
  `CHATVOLT_AGENT_ID` (id da Bia, na URL do agente) e, opcional,
  `CONFIRMACAO_DEMO_TEMPLATE` (padrão `oni_confirmacao_demo_v3`). Usa
  `CHATVOLT_API_KEY` e `CHATVOLT_AGENTE_ORG` que já existem.
- **Sem nova tentativa:** se o Chatvolt/Meta falhar, a linha fica `failed` com o
  motivo; se o envio saiu e a resposta se perdeu, repetir mandaria duas vezes. Para
  reenviar, apagar a linha de `demo_confirmations` da tarefa (enquanto a demo
  estiver na janela de 3 h).
- **Template (o defeito do v1):** o `oni_confirmacao_demo` original foi criado com
  a URL do botão `https://meet.google.com/%7B%7B1%7D%7D{{1}}` (um `{{1}}` literal
  antes da variável), que leva a um link de Meet inexistente. O formulário
  "Criar Novo Template" do Chatvolt **só cria botão de URL estático** (não manda o
  `example` que a Meta exige para URL dinâmica). O v3 foi criado com
  `POST /api/whatsapp/templates` (a mesma rota da tela) com
  `url: "https://meet.google.com/{{1}}"` e
  `example: ["https://meet.google.com/abc-defg-hij"]`. Só ligar o envio depois de
  a Meta aprovar o v3 (Chatvolt → Disparos → Gerenciar Templates: "Aprovado").
- **Cota:** o plano do Chatvolt mostra "Disp. WhatsApp 0 / 400"; confirmar se o
  envio por API consome essa cota.
- **Limites:** o horário vem de `tasks.due_date`; se o lead remarcar no Orbi, o CRM
  não fica sabendo (já era assim) e a confirmação sai para o horário antigo.

## Diagnóstico

```sql
select id, title, external_status, external_error, external_attempts, external_next_at
  from tasks where external_status is not null order by updated_at desc limit 20;
select * from orbi_cancels;
select organization_id, enabled, last_error, last_ok_at, booking_link from org_orbi_integrations;
```

```sql
-- Confirmação da demo (3 h antes)
select c.created_at, c.status, c.reason, c.template, t.title, t.due_date, t.meeting_url
  from demo_confirmations c join tasks t on t.id = c.task_id order by c.created_at desc limit 20;
```
