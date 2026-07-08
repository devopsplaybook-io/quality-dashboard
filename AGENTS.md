# AGENTS.md — Quality Dashboard

## Project Overview

Quality Dashboard is a self-hosted web application for aggregating, visualizing, and managing quality reports from CI/CD pipelines, security scanners, and other automated tools. It ingests reports via a pluggable processor system, stores them with versioning, and presents them through configurable dashboards with metric trends and tag-based filtering.

## Architecture

The project is a monorepo with three sub-projects:

```
quality-dashboard/
├── quality-dashboard-server/   # Fastify REST API (TypeScript, Node.js)
├── quality-dashboard-web/      # Nuxt 4 SPA frontend (Vue 3, Pinia)
├── quality-dashboard-proxy/    # Traefik reverse proxy (dev only)
├── tests/                      # Integration tests, E2E (Cypress), shell scripts
├── scripts/                    # CI/CD helper scripts (npm-audit, trivy, kyverno)
├── docs/dev/                   # Dev environment scripts and local data (gitignored)
├── Dockerfile                  # Multi-stage build (Node 26 Alpine)
└── ecosystem.config.js         # PM2 process manager config
```

### Server (`quality-dashboard-server`)

- **Runtime**: Node.js with Fastify 5
- **Language**: TypeScript (strict=false, target ES2020, CommonJS)
- **Database**: SQLite via `better-sqlite3`, with migration files in `sql/`
- **Observability**: OpenTelemetry (traces, metrics, logs) via `@devopsplaybook.io/otel-utils`
- **Shared utilities**: `@devopsplaybook.io/common-utils` for OTel context, Config base class, DB utils, Timeout

#### Key Modules

| Directory / File                   | Responsibility                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/App.ts`                       | Entry point. Boots config, OTel, DB, Fastify server, registers routes                                                  |
| `src/Config.ts`                    | Extends `ConfigBase` from common-utils. Project-specific fields: `TMP_DIR`, `PROCESSORS_*`, `MAX_UPLOAD_BYTES`         |
| `src/OTelContext.ts`               | Creates isolated OTel context (tracer/meter/logger singletons) via `createOTelContext()`                               |
| `src/utils-std-ts/`                | Re-exports from common-utils (`SqlDbUtils`, `Timeout`). Local `Logger` class (simple console logger)                   |
| `src/reports/`                     | Core domain: Reports, Tags, Dashboards CRUD + file storage + processor registry                                        |
| `src/reports/ReportsService.ts`    | Ingest orchestration: validate → upsert report → store file → run processor → persist version                          |
| `src/reports/ProcessorRegistry.ts` | Dynamic loading of JS processor plugins from `processors_system/` and `processors_custom/` dirs with hot-reload        |
| `src/reports/FileStorage.ts`       | Report file storage with 3-level hash directory structure, archive extraction (zip, tar.gz), path traversal protection |
| `src/users/`                       | Authentication (JWT), user management, password hashing (bcrypt)                                                       |
| `src/settings/`                    | Global settings (public dashboard toggle, upload token) stored in `metadata` table                                     |

#### Data Model

- **Report**: Named entity with a stable `key` (slug). Has many `ReportVersion`s.
- **ReportVersion**: One ingestion event. Contains metrics, processor info, optional file content.
- **Metric**: `{ name, type, value }` where type is `count | percentage | duration | boolean`.
- **ReportTag**: Key-value tags attached to a Report (applies to all versions).
- **Dashboard**: Tree of `DashboardLevelNode`s for hierarchical metric aggregation by tag.
- **Settings**: Singleton config (public/private, upload token).

#### API Routes

| Prefix            | Module           | Auth                                                  |
| ----------------- | ---------------- | ----------------------------------------------------- |
| `/api/reports`    | ReportsRoutes    | JWT required (upload token also accepted for uploads) |
| `/api/tags`       | TagsRoutes       | JWT required                                          |
| `/api/dashboards` | DashboardsRoutes | JWT required                                          |
| `/api/users`      | UsersRoutes      | Mixed (init endpoint public, others JWT)              |
| `/api/settings`   | SettingsRoutes   | JWT admin required                                    |
| `/api/status`     | Health check     | Public                                                |

#### Processor System

Processors are standalone `.js` files in `processors_system/` (bundled) or `processors_custom/` (user-provided). Each must export:

- `analyse(ctx: ProcessorContext): Promise<ProcessorResult>` — required
- `describe()` — optional metadata
- `formatReportPreview(ctx)` — optional preview formatter

System processors: `jest`, `json`, `kyverno`, `lcov-coverage`, `popeye-html`, `trivy-html`.

#### Database Migrations

SQL migration files in `sql/` follow the naming convention `init-NNNN.sql`. Applied migrations are tracked in the `metadata` table. The migration system is idempotent.

### Web (`quality-dashboard-web`)

- **Framework**: Nuxt 4 (Vue 3, SSR disabled — pure SPA)
- **State**: Pinia stores (`ReportsStore`, `TagsStore`, `DashboardsStore`, `AuthenticationStore`, `ApplicationSetttingsStore`)
- **UI**: PicoCSS + Bootstrap Icons
- **Pages**: Reports list, Report detail (with version history), Dashboards, Settings, Users (login, init, profile)

### Proxy (`quality-dashboard-proxy`)

Traefik-based reverse proxy for local development only. Routes API calls to the server and static requests to the web frontend.

## Build & Run

```bash
# Install dependencies (each sub-project independently)
cd quality-dashboard-server && npm install
cd quality-dashboard-web && npm install

# Development (PM2 manages all processes)
npm run dev   # runs docs/dev/run-dev-env.sh

# Build
cd quality-dashboard-server && npm run build   # tsc → dist/
cd quality-dashboard-web && npm run build      # nuxt build → .output/

# Docker
docker build -t quality-dashboard .
```

### Development Environment

The `ecosystem.config.js` sets `DATA_DIR` to `../docs/dev/data` and `TMP_DIR` to `../docs/dev/data/tmp` for local development. The `docs/dev/data/` directory is gitignored.

## Testing

```bash
# Server unit tests (Jest)
cd quality-dashboard-server && npm test

# Server linter (ESLint with typescript-eslint)
cd quality-dashboard-server && npm run lint

# Integration tests
cd tests/integration && npm test

# E2E tests (Cypress)
cd tests/tests-e2e && npx cypress run
```

### Test Conventions

- Unit tests: `*.spec.ts` colocated next to source files
- Tests use `ts-jest` with `tsconfig.spec.json`
- UUID module is mocked via `__mocks__/uuid.cjs` for deterministic IDs
- Coverage collected from `src/**/*.ts`

## Shared Libraries

| Package                                 | Source                     | Purpose                                                    |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `@devopsplaybook.io/common-utils`       | `_libs/common-utils`       | ConfigBase, OTel context, DB utils, Timeout, SystemCommand |
| `@devopsplaybook.io/otel-utils`         | `_libs/otel-utils`         | StandardTracer, StandardMeter, StandardLogger              |
| `@devopsplaybook.io/otel-utils-fastify` | `_libs/otel-utils-fastify` | Fastify request tracing hooks                              |

## Coding Conventions

- TypeScript with relaxed strictness (`strict: false`, `noImplicitAny: false`)
- ESLint: `@eslint/js` recommended + `typescript-eslint` strict + stylistic
- Module-level singletons for config and OTel context (set at startup, read everywhere)
- Repository pattern for database access (static methods on `*Repository` classes)
- All DB operations wrapped in OTel spans for tracing
- `// eslint-disable-next-line` used sparingly for `any` types at API boundaries

## Docker

Multi-stage build:

1. **Builder**: Node 26 Alpine with build tools (Python, GCC for native modules)
2. **Runtime**: Node 26 Alpine (minimal)

The final image contains `dist/`, `node_modules/`, `web/` (Nuxt output), `sql/`, `processors_system/`, and `config.json`.
