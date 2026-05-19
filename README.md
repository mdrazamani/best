# BEST Monorepo

This repository contains two independent applications:

- `apps/api` : NestJS + Prisma backend
- `apps/dashboard` : React + Vite admin panel

Each app runs with `npm` directly. No `pnpm` is required.

## Project Structure

```text
apps/
  api/
  dashboard/
docker-compose.dev.yaml
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local PostgreSQL)

## Start local database

```bash
docker compose -f docker-compose.dev.yaml up -d
```

## Run Full Stack With Docker

```bash
docker compose up -d --build
```

Endpoints:

- Dashboard: `http://localhost`
- API: `http://localhost/v1`
- Swagger: `http://localhost/docs`

Default manager account (seeded automatically in development):

- username: `superadmin`
- password: `Best@123456`

Production note:

- Set `SEED_SUPER_ADMIN_PASSWORD` explicitly in environment.
- Set `AUTH_JWT_SECRET` explicitly in environment.
- Database data is stored in named Docker volume `best_postgres_data`.
- Never run `docker compose down -v` in production, because `-v` removes database volume data.
- For updates, use `docker compose pull && docker compose up -d --build` to keep data intact.

## Run API

```bash
cd apps/api
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

Endpoints:

- API base: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/docs`

## Run Dashboard

```bash
cd apps/dashboard
npm install
npm run dev
```

Endpoint:

- Dashboard: `http://localhost:3002`

## Tests

API tests:

```bash
cd apps/api
npm test
```

Dashboard tests:

```bash
cd apps/dashboard
npm test
```

## Architecture notes

- Controllers are thin and contain no business logic.
- Services do not use Prisma models directly.
- Prisma access is restricted to repository classes.
- RBAC is implemented with roles and permissions.
- Domain is focused only on mesh workshop accounting.
