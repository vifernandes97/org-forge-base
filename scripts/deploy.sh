#!/usr/bin/env bash
# Deploy do app (crm.neosoluti.com.br) pelo webhook do Easypanel, e espera a
# versão nova de fato entrar no ar (o /health diz o commit, GIT_SHA do
# Easypanel) — push e "verde" no painel não garantem.
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

ALVO=$(git rev-parse HEAD)
no_ar() { curl -s "$URL/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('commit') or '')" 2>/dev/null || true; }
echo "deploy de ${ALVO:0:7} ($BRANCH); no ar agora: $(no_ar | cut -c1-7)"
disparar() { curl -fsS -X POST "$HOOK" -o /dev/null || curl -fsS "$HOOK" -o /dev/null; }
disparar
echo "webhook chamado; esperando a versão nova…"
for i in $(seq 1 60); do
  sleep 10
  AGORA=$(no_ar)
  if [ "$AGORA" = "$ALVO" ]; then echo "no ar após ~$((i*10))s: ${ALVO:0:7}"; exit 0; fi
  # Logo depois do push, o GitHub pode ainda informar o commit anterior ao
  # Easypanel, que sobe a versão velha (2026-10-26). Uma segunda chamada resolve.
  if [ "$i" = 18 ]; then echo "ainda ${AGORA:0:7} após 3 min; chamando o webhook de novo"; disparar; fi
done
echo "a versão nova não apareceu em 10 min (no ar: ${AGORA:-nada}). Logs: ssh vps 'docker service logs evolution_crm-app --tail 50'"
exit 1
