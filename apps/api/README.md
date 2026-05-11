# Arzmix API

Production-grade NestJS API focused on clean modular architecture, high performance, and security.

## Quick Start
```bash
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

## Tests
```bash
npm test
```

## Environment Files
Only these two files are valid:
- `.env`
- `.env.example`

## Development Infrastructure
Run from repository root:
```bash
docker compose -f docker-compose.dev.yaml up -d
```
This starts PostgreSQL and Redis under the compose project name `arzmix-dev`.

## HTTP/2 and Browser Fallback
- API transport is Fastify.
- When `HTTP2_ENABLED=true` and valid TLS files are provided, server runs on HTTP/2.
- `allowHTTP1=true` is enabled, so browsers/clients without HTTP/2 support automatically fall back to HTTP/1.1.
- If HTTP/2 is requested but TLS files are missing/invalid, server safely runs on HTTP/1.1.

## Core Architecture Rules
- One database table = one module.
- Each module keeps its own `entity` and `repository` files at module root (no `entities/` or `repositories/` folders).
- Database modules must use `BaseRepository` and `BaseService`.
- API controllers for a domain must live inside that domain module, not inside a separate API-only wrapper module.
- Controllers are required only for modules that expose HTTP APIs.
- Empty controllers are forbidden. If a module has no API, do not keep a controller file.
- If a module exposes API endpoints, those endpoints must be defined inside that module's own controllers.
- Creating aggregator modules only to host APIs of multiple data modules is forbidden (example anti-pattern: `blog`, `ticketing`, `referral` as wrapper-only API modules).
- For multi-entity workflows, place orchestration service in the owning domain module and consume other modules only via exported services.
- Controller class/file names must match their owner module naming (example: `PostsManagementPrivateController` in `modules/posts/controllers/posts-management-private.controller.ts`).
- Defining endpoints of module `A` inside controllers located in module `B` is forbidden.
- Remove obsolete files/directories immediately after refactors (old controller names, old wrapper modules, dead DTO/test imports).
- DTOs are separated from entities.
- Controllers only orchestrate request/response flow; business logic lives in services.
- Services must not use Prisma models directly.
- Cross-module access must be service-to-service, never repository-to-repository.
- Repositories must only operate on their own model/table.

## Repository Boundary Rule (Strict)
- A module service must not import repository files from other modules.
- If a module needs external data/behavior, it must consume the other module's service.
- This rule is enforced by automated tests.

## RBAC Rules
- API-based RBAC with `resource + apiName + method + path`.
- Every controller must define exactly one resource via `@Resource(...)`.
- System roles are immutable:
  - `super_admin`
  - `customer`
- New users are assigned `customer` role by default.

## i18n Rules
- Default locale is `fa`.
- If user is authenticated and `user.locale` exists, it is used first.
- If no user locale is available, locale is resolved from request headers (`x-locale`, then `accept-language`).
- All error messages are bilingual (`fa`, `en`) and must never be single-language only.

## Security Rules
- Access and refresh tokens are secure JWTs (HS512 + issuer + audience + jti + type).
- Access tokens are stateless and are not stored in database.
- Only refresh token hash is stored in sessions.
- Refresh token rotation is enabled.
- Password login lockout: 5 failed attempts -> 1 hour lock.
- OTP protections:
  - resend cooldown: 120 seconds
  - verify lock after repeated invalid attempts

## Session Rules
- Session stores rich client context for operational visibility and security:
  - device type/vendor/model
  - OS and version
  - browser and version
  - engine / cpu arch / platform
  - timezone / country / language
  - IP / user-agent / bot signal
- Session listing includes `current` and `isActive` flags.
- Inactive old sessions are cleaned up based on retention policy.

## Standard API Response Contract
Success:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "string",
    "path": "string",
    "timestamp": "ISO string",
    "locale": "fa|en"
  }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "statusCode": 400,
    "message": "localized message",
    "details": {}
  },
  "meta": {
    "requestId": "string",
    "path": "string",
    "timestamp": "ISO string",
    "locale": "fa|en"
  }
}
```

## Testing Policy
- Every module has a `tests/` folder.
- Unit and integration-like tests are required for critical services/controllers.
- Common guards/interceptors/filters/security layers must be tested.
- Mandatory coverage areas:
  - i18n
  - auth/otp security
  - session behavior
  - RBAC permissions and role constraints
  - architecture boundary rules
