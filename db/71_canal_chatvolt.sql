-- Conversas do Chatvolt (número da API oficial atendido pela Bia) entram como
-- mais um canal (docs/WHATSAPP.md §20): o webhook de saída do agente chama
-- /api/channels/chatvolt/<token>, e a mesma análise do WhatsApp cria tarefa,
-- nota e etapa — inclusive a Reunião que um humano combina pela caixa do
-- Chatvolt, que o trigger de db/66 manda ao Orbi.

alter table public.channel_servers drop constraint if exists channel_servers_provider_check;
alter table public.channel_servers add constraint channel_servers_provider_check check (provider in ('evolution', 'chatvolt'));
alter table public.channel_connections drop constraint if exists channel_connections_provider_check;
alter table public.channel_connections add constraint channel_connections_provider_check check (provider in ('evolution', 'chatvolt'));

