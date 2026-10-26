#!/usr/bin/env bash
# Deploy do app (crm.neosoluti.com.br) pelo webhook do Easypanel, e espera a
# versão nova de fato entrar no ar — push e "verde" no painel não garantem.
# Precisa de CRM_DEPLOY_WEBHOOK no .env.local (Easypanel → crm-app → Deploy
# Webhook). Só o app: crm-db e crm-rest são imagens fixas, trocadas no painel.
set -euo pipefail
cd "$(dirname "$0")/.."
URL=https://crm.neosoluti.com.br
HOOK=$(grep -E '^CRM_DEPLOY_WEBHOOK=' .env.local | tail -1 | cut -d= -f2-)
[ -n "$HOOK" ] || { echo "CRM_DEPLOY_WEBHOOK não está no .env.local"; exit 1; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin "$BRANCH"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "há mudanças não commitadas"; exit 1; fi
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then echo "o commit atual não está no GitHub (git push antes)"; exit 1; fi

bundle() { curl -s "$URL/" | grep -oE '/assets/index-[^"]+\.js' | head -1; }
ANTES=$(bundle || true)
echo "deploy de $(git rev-parse --short HEAD) ($BRANCH); bundle no ar: ${ANTES:-nenhum}"
curl -fsS -X POST "$HOOK" -o /dev/null || curl -fsS "$HOOK" -o /dev/null
echo "webhook chamado; esperando a versão nova…"
for i in $(seq 1 60); do
  sleep 10
  AGORA=$(bundle || true)
  if [ -n "$AGORA" ] && [ "$AGORA" != "$ANTES" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/health")" = 200 ]; then
    echo "no ar após ~$((i*10))s: $AGORA"; exit 0
  fi
done
echo "a versão nova não apareceu em 10 min (bundle: ${AGORA:-nenhum}). Logs: ssh vps 'docker service logs evolution_crm-app --tail 50'"
exit 1
