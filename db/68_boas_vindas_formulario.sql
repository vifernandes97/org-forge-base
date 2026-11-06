-- Boas-vindas sem a frase (docs/WHATSAPP.md §17): metade dos leads do
-- formulário não chama no WhatsApp. 10 min depois do formulário, se o lead não
-- escreveu, o CRM manda pelo n8n um texto curto e o áudio do segmento para o
-- telefone do formulário.
--
-- channel_connections.welcome_form_text: o texto ({nome} = primeiro nome do
--   contato). Nulo = envio sem a frase desligado.
-- channel_welcomes.origin: 'phrase' (o lead mandou a frase) ou 'form'
--   (envio depois do formulário, sem conversa: chat_id nulo).
-- channel_welcomes.intro_message_id: id do texto, que a IA também lê como
--   mensagem automática.

alter table public.channel_connections add column if not exists welcome_form_text text;

alter table public.channel_welcomes
  alter column chat_id drop not null,
  add column if not exists origin text not null default 'phrase' check (origin in ('phrase','form')),
  add column if not exists intro_message_id text;
create index if not exists channel_welcomes_intro_idx on public.channel_welcomes (connection_id, intro_message_id) where intro_message_id is not null;
create index if not exists channel_welcomes_lead_idx on public.channel_welcomes (lead_id) where lead_id is not null;

notify pgrst, 'reload schema';
