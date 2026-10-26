#!/usr/bin/env bash
# Aplica as migrações (Supabase, depois Drizzle) numa base, uma transação por arquivo.
# Uso: neon/aplicar-schema.sh <url-do-banco> [neon/local_auth.sql, só fora do Neon]
set -euo pipefail
cd "$(dirname "$0")/.."
URL="$1"; shift
PSQL=(psql "$URL" -q -X -v ON_ERROR_STOP=1)
for f in "$@" neon/00_supabase_shim.sql; do "${PSQL[@]}" -1 -f "$f"; done
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
  # pg_net não existe no Neon: a linha da extensão sai; a saída de webhook
  # passa a ser despachada pelo cron (90_sem_pg_net.sql desliga o trigger).
  if ! out=$(grep -viE '^[[:space:]]*create extension[^;]*pg_net' "$f" | sed -f neon/traduzir.sed | "${PSQL[@]}" -1 -f - 2>&1); then echo "FALHOU: $f"; echo "$out" | head -8; exit 1; fi
  n=$((n+1))
done
# Depois das migrações: identidade (10_*) e ajustes do Neon (90_*), em ordem.
for f in neon/[1-9][0-9]_*.sql; do "${PSQL[@]}" -1 -f "$f"; done
echo "ok: $n migrações"
