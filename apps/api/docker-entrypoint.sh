#!/bin/sh
set -e

find_prisma() {
  if [ -x "./node_modules/.bin/prisma" ]; then
    echo "./node_modules/.bin/prisma"
    return 0
  fi

  if [ -x "/app/apps/api/node_modules/.bin/prisma" ]; then
    echo "/app/apps/api/node_modules/.bin/prisma"
    return 0
  fi

  if [ -x "/app/node_modules/.bin/prisma" ]; then
    echo "/app/node_modules/.bin/prisma"
    return 0
  fi

  if command -v prisma >/dev/null 2>&1; then
    command -v prisma
    return 0
  fi

  return 1
}

PRISMA_BIN="$(find_prisma || true)"
if [ -z "${PRISMA_BIN}" ]; then
  echo "ERROR: prisma CLI not found. Expected one of:" >&2
  echo "  - ./node_modules/.bin/prisma" >&2
  echo "  - /app/apps/api/node_modules/.bin/prisma" >&2
  echo "  - /app/node_modules/.bin/prisma" >&2
  exit 1
fi

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  "${PRISMA_BIN}" migrate deploy
fi

if [ "${RUN_SEED}" = "true" ]; then
  "${PRISMA_BIN}" db seed
fi

exec node dist/main.js
