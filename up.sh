#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example"
fi

if [ ! -f "apps/api/.env" ]; then
  cp apps/api/.env.example apps/api/.env
  echo "Created apps/api/.env from .env.example"
fi

if [ ! -f "apps/dashboard/.env" ]; then
  cp apps/dashboard/.env.example apps/dashboard/.env
  echo "Created apps/dashboard/.env from .env.example"
fi

docker compose up -d --build
docker compose ps
