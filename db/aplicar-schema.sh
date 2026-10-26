#!/usr/bin/env bash
# Monta o banco do zero: papéis e auth.* (00), shim do Supabase (01), as 54
# migrações (Supabase, depois Drizzle) traduzidas por traduzir.sed, e por fim
# identidade (10) e ajustes (90). Uma transação por arquivo.
# Uso: db/aplicar-schema.sh <url-do-dono-do-banco>
# Depois: db/criar-papeis.sh (senhas de authenticator e app_auth_svc).
set -euo pipefail
cd "$(dirname "$0")/.."
URL="$1"
PSQL=(psql "$URL" -q -X -v ON_ERROR_STOP=1)
for f in db/0[0-9]_*.sql; do "${PSQL[@]}" -1 -f "$f"; done
FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(ls supabase/migrations/*.sql | sort; python3 -c "import json;[print('drizzle/migrations/'+e['tag']+'.sql') for e in json.load(open('drizzle/migrations/meta/_journal.json'))['entries']]")
n=0
for f in "${FILES[@]}"; do
  # Migrações de dados do Lovable miram a organização da Oniplataforma; num banco
  # vazio (dev/ensaio) ela é criada antes, para o arquivo rodar inteiro. Na
  # migração de verdade o schema vem do export, não deste replay.
  case "$f" in *20260306132659_*|*20260422183214_*)
    "${PSQL[@]}" -c "insert into public.organizations (id, name, slug) values ('ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa', 'Oniplataforma (ensaio)', 'oniplataforma-ensaio') on conflict do nothing" ;;
  esac
  # Drift: execute_automations() existe em produção, mas nenhuma migração a
  # cria (a 0003 só revoga). Stub no replay; o export é quem diz o que ela é.
  case "$f" in *0003_harden_definer*)
    "${PSQL[@]}" -c "create function public.execute_automations() returns trigger language plpgsql as \$\$ begin return new; end \$\$" 2>/dev/null || true ;;
  esac
  # pg_net não existe na imagem oficial: a linha da extensão sai; a saída de
  # webhook passa a ser despachada pelo cron do app (90_sem_pg_net.sql).
  if ! out=$(grep -viE '^[[:space:]]*create extension[^;]*pg_net' "$f" | sed -f db/traduzir.sed | "${PSQL[@]}" -1 -f - 2>&1); then echo "FALHOU: $f"; echo "$out" | head -8; exit 1; fi
  n=$((n+1))
done
for f in db/[1-9][0-9]_*.sql; do "${PSQL[@]}" -1 -f "$f"; done
# A organização de ensaio só existia para as migrações de dados rodarem; ela
# tem o id da Oniplataforma real e daria conflito na importação do export.
"${PSQL[@]}" -1 <<'SQL'
delete from public.custom_field_values where field_definition_id in
  (select id from public.custom_field_definitions where organization_id = 'ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa');
delete from public.custom_field_definitions where organization_id = 'ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa';
delete from public.organizations where id = 'ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa';
SQL
echo "ok: $n migrações"
