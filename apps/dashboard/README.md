# Errnox Dashboard

Main product dashboard for monitoring, issues, alerts, billing, deployments, and workspace operations.

## Stack

- React 18
- Vite
- TypeScript
- TanStack Query

## Prerequisites

- Node.js 20+
- npm 10+
- Running API (`/v1`)

## Setup

From repository root:

```bash
npm install
npm --prefix apps/dashboard run dev
```

Default local URL: `http://localhost:3002`

`dev` runs Vite only and does not auto-start API.
If you want dashboard + API bootstrap in one command:

```bash
npm --prefix apps/dashboard run dev:stack
```

## Environment Variables

Configured via `apps/dashboard/vite.config.ts`:

- `VITE_PORT`: dev server port (default `3002`)
- `VITE_API_BASE_URL`: browser API base path (default `/v1`)
- `VITE_API_ALLOW_HTTP_FALLBACK`: when `true`, absolute `https://...` API base URLs can downgrade to `http://...` on transport errors (default `true` outside production, `false` in production)
- `VITE_PROXY_TARGET`: upstream API in local dev (default `http://localhost:3000`)
- `DASHBOARD_SKIP_API_BOOTSTRAP`: set `true` to skip API auto-start in `dev:stack`
- `DASHBOARD_API_BOOT_TIMEOUT_MS`: wait timeout for API health before starting Vite (default `120000`)

## Scripts

- `npm --prefix apps/dashboard run dev`
- `npm --prefix apps/dashboard run dev:stack`
- `npm --prefix apps/dashboard run build`
- `npm --prefix apps/dashboard run preview`
- `npm --prefix apps/dashboard run lint`
- `npm --prefix apps/dashboard run test`

## Auth and Access Model

- Login is OTP-based (`/v1/auth/request-otp`, `/v1/auth/verify-otp`).
- Workspace-scoped pages require an authenticated session.
- Role-based rules are enforced server-side by API guards.

## Discover (Advanced)

Dashboard route: `/discover`

Capabilities:

- Dataset selector: `events | transactions | logs`
- Query builder for `columns`, `filters`, `groupBy`, `aggregates`, `limit`
- Result table + chart rendering from dynamic query columns
- Saved Views integration:
  - load saved discover query into builder
  - save current discover query as personal/shared view

Safety alignment:

- UI sends allow-listed payload shape to `POST /v1/discover`
- Limit is clamped to `500`
- Degraded backend responses are shown as explicit warning banners (no silent empty state)

## Trace Explorer

Dashboard route: `/trace-explorer`

Capabilities:

- Search traces by `service`, `op`, `status`, duration range, error-only flag, and time range
- Result tables for slowest traces and error traces
- Row click deep-links to existing trace timeline view:
  - `/performance?trace=<trace_id>`

API integration:

- `GET /v1/performance/traces/search`
- supports cursor pagination (`nextCursor`) and explicit degraded diagnostics

## Browser RUM (Web Vitals)

Dashboard route: `/rum`

Capabilities:

- time-range filters with optional `environment`, `release`, and `pagePrefix`
- trend charts for `LCP`, `CLS`, `INP`, `TTFB`, and `FCP`
- slow pages table (Top N by p95)
- browser breakdown table

Behavior:

- queries `GET /v1/rum/overview`, `GET /v1/rum/pages`, and `GET /v1/rum/browsers`
- shows explicit degraded banner when backend responds with degraded diagnostics
- respects workspace/project scope selected in dashboard context

## Session Replay (Visual Player)

Dashboard routes:

- `/sessions` (replay index + embedded player)
- `/sessions/replay/:sessionId` (full replay player page)

Player capabilities:

- DOM replay playback (iframe snapshot rendering)
- play/pause
- timeline scrubber
- speed control (`0.5x`, `1x`, `1.5x`, `2x`)
- click/navigation overlay
- side panes for console logs, network breadcrumbs, and timeline breadcrumbs

API integration:

- chunked replay fetch via cursor pagination from `GET /v1/sessions/:sessionId/replay`
- replay metadata from `GET /v1/sessions/:sessionId/replay/meta`
- explicit degraded status handling in UI (`status`, `warnings`, `partial`)

Deep links:

- Logs and Issues can open replay directly when `session_id` exists:
- `/sessions/replay/:sessionId?at=<timestamp>`

## GDPR / DSAR (Workspace Settings)

Dashboard location:

- `/settings` -> `GDPR / DSAR` card

Capabilities:

- create DSAR request (`export` or `delete`) with identifiers:
  - `email`
  - `user_id`
  - `ip`
- list request status (`pending`, `running`, `done`, `failed`)
- trigger async run
- download completed export bundle (`.json.gz`)

Notes:

- backend enforces workspace-admin authorization for all DSAR operations
- request lifecycle is auditable and visible from DSAR detail APIs

## Deployment

### Docker image (standalone)

```bash
docker build -f apps/dashboard/Dockerfile -t errnox-dashboard apps/dashboard
docker run --rm -p 3002:80 errnox-dashboard
```

### Staging/compose deployment

Use repo root compose:

```bash
npm run docker:up
```

Dashboard becomes available at `http://localhost:3002`.

## Troubleshooting

- API calls fail in dev:
  - Verify `VITE_PROXY_TARGET` and API reachability at `http://localhost:3000/v1`.
- Login loop:
  - Clear browser storage and retry OTP.
- Empty workspace/project selectors:
  - Seed demo data (`npm --prefix apps/api run seed`) and sign in again.
- Production build issues:
  - Run `npm --prefix apps/dashboard run lint` then `build` to catch type errors first.
