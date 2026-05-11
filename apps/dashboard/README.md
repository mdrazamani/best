# BEST Dashboard

Persian RTL dashboard for BEST mesh workshop accounting system.

## Features

- Responsive sidebar + top header
- Light / Dark theme toggle
- Orders, invoices, collaborators, customers, mesh types, users, backups, activity logs
- Persian date and number formatting

## Run

```bash
npm install
npm run dev
```

## Local Fonts

Project keeps local fonts in `public/fonts`:

- Vazirmatn
- Inter
- JetBrains Mono

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## API

By default dashboard calls `/v1` and Vite proxy forwards to `http://127.0.0.1:3000`.

## Docker

Run from repository root:

```bash
docker compose up -d --build
```
