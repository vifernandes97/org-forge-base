#!/bin/sh
# Segredos entram por arquivo (File mount do Easypanel em /app/secrets.env),
# nunca pela aba Environment: o Easypanel repassa cada env como --build-arg e
# imprime no log de build.
set -e
if [ -f /app/secrets.env ]; then
  set -a
  . /app/secrets.env
  set +a
fi
exec bun server/index.ts
