#!/usr/bin/env bash
# Acesso temporário ao Postgres de produção (evolution_crm-db, sem porta
# exposta): uma ponte socat na rede interna, publicada só em 127.0.0.1 da VPS,
# e um túnel SSH até ela. A URL do dono vai para um arquivo 600 fora do repo.
#   scripts/tunel-db.sh abrir   → imprime o caminho do arquivo com a URL
#   scripts/tunel-db.sh fechar  → derruba túnel e ponte
set -euo pipefail
PORTA=55433
ARQ="${TMPDIR:-/tmp}/crm-prod-owner-url"
case "${1:-}" in
  abrir)
    ssh -o BatchMode=yes vps "docker rm -f crm-db-ponte >/dev/null 2>&1; docker run -d --name crm-db-ponte --network easypanel-evolution -p 127.0.0.1:$PORTA:5432 alpine/socat:1.8.0.3 tcp-listen:5432,fork,reuseaddr tcp-connect:crm-db:5432 >/dev/null"
    pkill -f "$PORTA:127.0.0.1:$PORTA" 2>/dev/null || true
    ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -fN -L 127.0.0.1:$PORTA:127.0.0.1:$PORTA vps
    SENHA=$(ssh -o BatchMode=yes vps 'docker service inspect evolution_crm-db --format "{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}" | sed -n "s/^POSTGRES_PASSWORD=//p"')
    umask 077
    python3 -c "import sys,urllib.parse as u;print('postgres://postgres:'+u.quote(sys.argv[1],safe='')+'@127.0.0.1:$PORTA/crm')" "$SENHA" > "$ARQ"
    echo "$ARQ" ;;
  fechar)
    pkill -f "$PORTA:127.0.0.1:$PORTA" 2>/dev/null || true
    ssh -o BatchMode=yes vps 'docker rm -f crm-db-ponte >/dev/null 2>&1 || true'
    rm -f "$ARQ"
    echo "fechado" ;;
  *) echo "uso: $0 abrir|fechar"; exit 1 ;;
esac
