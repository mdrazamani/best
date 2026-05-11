# BEST API

Backend service for BEST mesh workshop accounting panel.

## Stack

- NestJS (Fastify)
- Prisma + PostgreSQL
- JWT auth (access + refresh)
- Swagger docs

## Run

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

## Endpoints

- API base: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/docs`

## Docker

Run from repository root:

```bash
docker compose up -d --build
```

API container runs:

1. `npm run prisma:push`
2. `npm run seed:js`
3. `npm run start:prod`

## Seeder default user

- username: `superadmin`
- password: `Best@123456`

## Commands

```bash
npm run dev
npm run build
npm test
```
