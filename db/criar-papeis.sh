#!/usr/bin/env bash
# Cria (ou troca a senha de) os dois papéis com login e grava as URLs deles
# num arquivo de env. As senhas nunca vão para o repo nem para a saída.
#   authenticator  o PostgREST entra com ele e troca para anon/authenticated
#   app_auth_svc   o Better Auth: só o schema app_auth
# Uso: db/criar-papeis.sh <url-do-dono> <arquivo-env> [host:porta vistos pelo app]
#   O 3º argumento troca o host nas URLs gravadas (ex.: o nome do serviço do
#   banco na rede interna do Easypanel, quando se roda isto por um túnel SSH).
set -euo pipefail
cd "$(dirname "$0")/.."
OWNER="$1"; ARQ="$2"; HOST_APP="${3:-}"
SENHA_REST=$(openssl rand -hex 24)
SENHA_AUTH=$(openssl rand -hex 24)
psql "$OWNER" -q -X -v ON_ERROR_STOP=1 -v rest="$SENHA_REST" -v auth="$SENHA_AUTH" <<'SQL'
select format(case when exists (select 1 from pg_roles where rolname = 'authenticator')
  then 'alter role authenticator with login noinherit password %L'
  else 'create role authenticator with login noinherit password %L' end, :'rest') \gexec
grant anon, authenticated, service_role to authenticator;
select format(case when exists (select 1 from pg_roles where rolname = 'app_auth_svc')
  then 'alter role app_auth_svc with login password %L'
  else 'create role app_auth_svc with login password %L' end, :'auth') \gexec
SQL
psql "$OWNER" -q -X -v ON_ERROR_STOP=1 -1 -f db/10_app_auth.sql
touch "$ARQ"
OWNER="$OWNER" HOST_APP="$HOST_APP" SENHA_REST="$SENHA_REST" SENHA_AUTH="$SENHA_AUTH" ARQ="$ARQ" python3 - <<'PY'
import os, re, urllib.parse as u
p = u.urlsplit(os.environ["OWNER"])
host = os.environ["HOST_APP"] or (p.hostname + (f":{p.port}" if p.port else ""))
def url(user, senha):
    return u.urlunsplit((p.scheme, f"{user}:{senha}@{host}", p.path, p.query, ""))
arq = os.environ["ARQ"]
s = open(arq).read()
for k, v in (("PGRST_DB_URI", url("authenticator", os.environ["SENHA_REST"])),
             ("APP_AUTH_DATABASE_URL", url("app_auth_svc", os.environ["SENHA_AUTH"]))):
    line = f"{k}={v}"
    s = re.sub(rf"^{k}=.*$", lambda _: line, s, flags=re.M) if re.search(rf"^{k}=", s, re.M) else s.rstrip("\n") + ("\n" if s.strip() else "") + line + "\n"
open(arq, "w").write(s)
PY
echo "ok: authenticator e app_auth_svc prontos; PGRST_DB_URI e APP_AUTH_DATABASE_URL gravadas em $ARQ"
