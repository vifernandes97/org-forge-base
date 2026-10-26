#!/usr/bin/env bash
# Cria (ou troca a senha de) app_auth_svc numa branch do Neon e grava a URL
# dele no .env.local. A senha nunca vai para o repo nem para a saída.
# Uso: neon/criar-papel-auth.sh   (lê DATABASE_URL_UNPOOLED/DATABASE_URL do .env.local)
set -euo pipefail
cd "$(dirname "$0")/.."
get() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g"; }
OWNER_DIRECT=$(get DATABASE_URL_UNPOOLED)
OWNER_POOLED=$(get DATABASE_URL)
SENHA=$(openssl rand -hex 24)
psql "$OWNER_DIRECT" -q -X -v ON_ERROR_STOP=1 -v senha="$SENHA" <<'SQL'
select format(case when exists (select 1 from pg_roles where rolname = 'app_auth_svc')
  then 'alter role app_auth_svc with login password %L'
  else 'create role app_auth_svc with login password %L' end, :'senha') \gexec
SQL
psql "$OWNER_DIRECT" -q -X -v ON_ERROR_STOP=1 -1 -f neon/10_app_auth.sql
# Mesma host/base da URL com pooling do dono, outro usuário.
AUTH_URL=$(OWNER_POOLED="$OWNER_POOLED" SENHA="$SENHA" python3 -c '
import os, urllib.parse as u
p = u.urlsplit(os.environ["OWNER_POOLED"])
host = p.hostname + (f":{p.port}" if p.port else "")
print(u.urlunsplit((p.scheme, f"app_auth_svc:{os.environ["SENHA"]}@{host}", p.path, p.query, "")))')
put() { # troca ou acrescenta CHAVE=valor sem ecoar o valor
  python3 - "$1" "$2" <<'PY'
import sys, re
k, v = sys.argv[1], sys.argv[2]
s = open('.env.local').read()
line = f"{k}={v}"
s = re.sub(rf"^{k}=.*$", lambda _: line, s, flags=re.M) if re.search(rf"^{k}=", s, re.M) else s.rstrip("\n") + "\n" + line + "\n"
open('.env.local', 'w').write(s)
PY
}
put APP_AUTH_DATABASE_URL "$AUTH_URL"
echo "ok: app_auth_svc pronto; APP_AUTH_DATABASE_URL gravada no .env.local"
