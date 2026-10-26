#!/usr/bin/env bash
# Importa o export do Lovable Cloud (pg_dump custom, .backup ou .zip) para um
# banco já montado por aplicar-schema.sh + criar-papeis.sh e VAZIO.
#   1. restaura o export num Postgres 17 temporário (Docker), como veio
#   2. usuários: auth.users → app_auth.users + app_auth.account (mesmo id,
#      hash bcrypt como está; o Better Auth aceita — server/auth.ts)
#   3. dados do schema public, com gatilhos e FKs desligados durante a carga
#      (o export já é consistente; os gatilhos gravariam histórico de novo)
#   4. a fila de webhooks antiga entra já despachada (db/30_fila_webhooks.sql)
#   5. confere linha a linha a contagem de cada tabela, origem × destino
# Uso: db/importar-export.sh <export.backup|.zip> <url-do-dono-do-destino>
set -euo pipefail
cd "$(dirname "$0")/.."
EXPORT="$1"; DESTINO="$2"
TMP=$(mktemp -d); trap 'docker rm -f crm-import-origem >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
if [[ "$EXPORT" == *.zip ]]; then unzip -q "$EXPORT" -d "$TMP/zip"; EXPORT=$(ls "$TMP"/zip/*.backup | head -1); fi

D=(psql "$DESTINO" -q -X -v ON_ERROR_STOP=1)
VAZIO=$("${D[@]}" -At -c "select (select count(*) from public.organizations) + (select count(*) from app_auth.users)")
[ "$VAZIO" = 0 ] || { echo "o destino não está vazio ($VAZIO linhas em organizations + users); nada foi feito"; exit 1; }

echo "1/5 restaurando o export num Postgres temporário…"
docker rm -f crm-import-origem >/dev/null 2>&1 || true
docker run -d --name crm-import-origem -e POSTGRES_PASSWORD=x -p 127.0.0.1:54341:5432 postgres:17 >/dev/null
ORIGEM=postgres://postgres:x@127.0.0.1:54341/postgres
for _ in $(seq 1 30); do pg_isready -h 127.0.0.1 -p 54341 -q && break; sleep 1; done
sleep 2
psql "$ORIGEM" -q -X -c "do \$\$ declare r text; begin foreach r in array array['anon','authenticated','service_role','supabase_admin','supabase_auth_admin','authenticator','supabase_storage_admin','dashboard_user'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if; end loop; end \$\$"
# Erros esperados: pg_net e supabase_vault (extensões só do Supabase).
pg_restore -d "$ORIGEM" --no-owner --no-privileges "$EXPORT" 2>"$TMP/restore.log" || true
INESPERADOS=$(grep 'error:' "$TMP/restore.log" | grep -vcE 'pg_net|supabase_vault|vault\.secrets' || true)
[ "$INESPERADOS" = 0 ] || { echo "erros inesperados no restore:"; grep 'error:' "$TMP/restore.log" | grep -vE 'pg_net|supabase_vault|vault\.secrets'; exit 1; }
O=(psql "$ORIGEM" -q -X -v ON_ERROR_STOP=1)

echo "2/5 usuários…"
"${O[@]}" -c "\copy (select id, email, coalesce(raw_user_meta_data->>'full_name', ''), email_confirmed_at is not null, raw_user_meta_data, created_at, coalesce(updated_at, created_at) from auth.users where deleted_at is null) to '$TMP/users.csv' csv"
"${O[@]}" -c "\copy (select id, encrypted_password, created_at, coalesce(updated_at, created_at) from auth.users where deleted_at is null and coalesce(encrypted_password, '') <> '') to '$TMP/senhas.csv' csv"
"${D[@]}" <<SQL
begin;
-- Sem o gatilho que cria o profile: os profiles vêm do export.
set local session_replication_role = replica;
\copy app_auth.users (id, email, name, email_verified, raw_user_meta_data, created_at, updated_at) from '$TMP/users.csv' csv
create temp table senhas (user_id uuid, hash text, created_at timestamptz, updated_at timestamptz);
\copy senhas from '$TMP/senhas.csv' csv
insert into app_auth.account (account_id, provider_id, user_id, password, created_at, updated_at)
  select user_id::text, 'credential', user_id, hash, created_at, updated_at from senhas;
commit;
SQL

echo "3/5 dados do public…"
pg_dump "$ORIGEM" -Fc --data-only --schema=public -f "$TMP/public.dump"
pg_restore -d "$DESTINO" --data-only --disable-triggers --no-owner --exit-on-error "$TMP/public.dump"

echo "4/5 fila de webhooks antiga marcada como despachada…"
"${D[@]}" -At -c "update public.webhook_logs set dispatched_at = created_at where error_message = 'pending_dispatch' and dispatched_at is null" | sed 's/^/   /'

echo "5/5 conferindo contagens (origem × destino)…"
CONTA="select tablename || ' ' || (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || quote_ident(tablename), false, true, '')))[1]::text from pg_tables where schemaname = 'public' order by 1"
"${O[@]}" -At -c "$CONTA" > "$TMP/c-origem"
"${D[@]}" -At -c "$CONTA" > "$TMP/c-destino"
"${O[@]}" -At -c "select 'usuarios ' || count(*) from auth.users where deleted_at is null" >> "$TMP/c-origem"
"${D[@]}" -At -c "select 'usuarios ' || count(*) from app_auth.users" >> "$TMP/c-destino"
if diff "$TMP/c-origem" "$TMP/c-destino" >/dev/null; then
  echo "   ok: $(wc -l < "$TMP/c-origem" | tr -d ' ') contagens iguais, $(awk '{s+=$2} END {print s}' "$TMP/c-origem") linhas"
else
  echo "   DIFERENÇAS (origem | destino):"; diff -y --suppress-common-lines "$TMP/c-origem" "$TMP/c-destino"; exit 1
fi
