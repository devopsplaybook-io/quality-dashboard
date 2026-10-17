# Quality-Dashboard

Centralise quality reports generated in CI/CD: unit tests, coverage, integration tests, security scans, ...

Designed to be light, fast, and easy to extend with custom processors.

![Application Screenshot](https://raw.githubusercontent.com/DidierHoarau/quality-dashboard/bf14f25a47b7212cb13c9278ad409ef4f2491889/_dev/img/screenshot.png "Quality Dashboard Screenshot")

## How it works

The system is built around four entities:

- **Report** — a logical, long-lived item identified by a unique **`key`** (slug) plus an optional **`displayName`**.
- **ReportVersion** — every upload creates a new version of the report (older versions are kept). Each version owns the metrics, the optional file, and the timestamp.
- **ReportTag** — `tag=value` pairs attached to a Report (not a version). Tags apply to all past and future versions and are managed independently from uploads.
- **GateRule** — per-report quality thresholds (e.g. `tests.failed <= 0`, `coverage.lines >= 80`). Rules are evaluated at ingest; every version stores an overall **pass/warn/fail** gate status plus per-rule results, shown on report cards, version cards, dashboard nodes and the status badge.
- **Dashboard** — a saved view, defined as an ordered list of **levels**. A level is either a `tag` (groups by every value of that tag) or `tag=value` (filters reports having that exact pair).

Flow:

1. A CI job uploads a report with three things only:
   - A **`key`** (unique identifier of the Report; same `key` ⇒ new version)
   - A **`processor`** name (e.g. `jest-html-reporter`, `lcov-coverage`, `json`, ...)
   - **Data** — either a file (single, `.zip`, or `.tar.gz`) and/or a `jsonPayload` (passed to JSON-aware processors)
2. The processor analyses the input and produces a flat list of **metrics**, each with `name`, `type`, and `value`. Supported types: `count`, `percentage`, `duration`, `boolean`.
3. Metrics are stored per version in the database; files are stored on disk keyed by version id.
4. **Quality gate rules** of the report are evaluated against the metrics: the worst result becomes the version's overall gate status. When a version **fails** its gate and a webhook URL is configured, a JSON notification is POSTed to it.
5. Tags are managed separately by the user (UI or API).
6. The web UI shows:
   - The **list of recent uploads** (chronological, up to 100 latest versions across all reports).
   - User-defined **dashboards** that aggregate the **latest version** of each matching report along the configured levels.
   - A **status badge** per report (`/api/reports/:key/badge.svg`) with a copyable markdown snippet.

## Installation

The recommended approach is to deploy the services as containers:

- **Server** (`quality-dashboard-server`) — backend, holds metrics + report files.
- **Web UI** (`quality-dashboard-web`) — frontend.
- Optional **Proxy** (`quality-dashboard-proxy`) — routes `/api` to the server and `/` to the web UI.

Deployment examples:

- Docker Compose: [`examples/quality-dashboard-docker-compose`](examples/quality-dashboard-docker-compose)
- Kubernetes: [`examples/quality-dashboard-kubernetes`](examples/quality-dashboard-kubernetes)

### Server environment variables

| Variable               | Default                  | Description                   |
| ---------------------- | ------------------------ | ----------------------------- |
| `API_PORT`             | `8080`                   | HTTP port                     |
| `DATA_DIR`             | `/opt/data`              | Persistent data root          |
| `REPORT_DIR`           | `${DATA_DIR}/reports`    | Report files                  |
| `TMP_DIR`              | `${DATA_DIR}/tmp`        | Upload staging                |
| `PROCESSORS_USER_DIR`  | `${DATA_DIR}/processors` | Custom processors (`.js`)     |
| `MAX_UPLOAD_BYTES`     | `209715200` (200 MB)     | Max upload size               |
| `PROCESSOR_TIMEOUT_MS` | `30000`                  | Per-processor timeout         |
| `CORS_POLICY_ORIGIN`   | -                        | Allowed origin for the web UI |
| `AUTH_TOKEN_VALIDITY`  | `3600`                   | JWT validity (seconds)        |

## API

Base URL: `<server>/api`. All requests use JSON unless noted.

### Reports

#### `GET /api/reports/processors`

Lists the available processors:

```json
{
  "processors": [
    { "name": "jest-html-reporter", "accepts": ["html"], "summary": "..." }
  ]
}
```

#### `GET /api/reports`

Lists all Reports (logical entities, not versions). Each report includes its tags.

```json
{
  "reports": [
    {
      "key": "my-team/my-app/unit-tests",
      "displayName": "Unit tests",
      "tags": [
        { "tag": "team", "value": "platform" },
        { "tag": "env", "value": "prod" }
      ],
      "dateCreated": "2026-05-16T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/reports/recent?limit=100&since=<ISO8601>`

Returns the most recent **ReportVersions** (across all reports), reverse-chronological. Default `limit` is 100. This is what the homepage shows.

```json
{
  "versions": [
    {
      "id": "01HZX...",
      "reportKey": "my-team/my-app/unit-tests",
      "displayName": "Unit tests",
      "processor": "jest-html-reporter",
      "metrics": [{ "name": "tests.passed", "type": "count", "value": 42 }],
      "fileEntrypoint": "test-report.html",
      "hasFile": true,
      "info": {},
      "tags": [{ "tag": "team", "value": "platform" }],
      "dateCreated": "2026-05-16T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/reports/history?limit=50`

Returns a bounded metric history: the `limit` most recent **ReportVersions** **per report** (default `50`, max `100`), grouped per report in the payload, each group ordered newest first. This is what powers the report cards' sparklines and trend arrows with a single request.

```json
{
  "versions": [
    {
      "id": "01HZX...",
      "reportKey": "my-team/my-app/unit-tests",
      "metrics": [{ "name": "tests.passed", "type": "count", "value": 42 }],
      "dateCreated": "2026-05-16T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/reports/:key`

Returns a single Report (with tags). The `:key` segment must be URL-encoded (it may contain `.`, `:`, `/`).

#### `PUT /api/reports/:key`

Update the `displayName` of a Report. Body: `{ "displayName": "..." }`. Requires authentication.

#### `DELETE /api/reports/:key`

Deletes a Report and **all** its versions. Requires authentication.

#### `GET /api/reports/:key/versions`

Lists all versions of a Report (newest first).

#### `GET /api/reports/:key/versions/:versionId`

Returns a specific version.

#### `DELETE /api/reports/:key/versions/:versionId`

Deletes a single version. Requires authentication.

#### `GET /api/reports/:key/gates`

Returns the quality gate rules of a Report:

```json
{
  "gates": [
    {
      "id": "01HZX...",
      "metric": "tests.failed",
      "operator": "<=",
      "warnValue": null,
      "failValue": 0,
      "dateCreated": "2026-05-16T10:00:00.000Z"
    }
  ]
}
```

Semantics: `<=` means lower is better (fail when `value > failValue`, warn when `value > warnValue`); `>=` means higher is better (fail when `value < failValue`, warn when `value < warnValue`). Metric matching is exact and case-sensitive; a rule whose metric is absent from an upload is skipped (does not fail the gate). `warnValue` is optional. The overall status of a version is the worst result across evaluable rules, or `null` when the report has no gate rules.

#### `PUT /api/reports/:key/gates`

Replaces all gate rules of a Report. Body: `{ "gates": [{ "metric": "tests.failed", "operator": "<=", "failValue": 0 }, ...] }`. Requires authentication.

Each rule requires a non-empty `metric` string, an `operator` of `<=` or `>=`, a finite number `failValue`, and an optional finite number `warnValue` (or `null`).

Rules are **retro-applied**: every stored version of the report is re-evaluated on save, so statuses stay consistent without re-uploading. Responds with the stored rules (including generated `id`s).

#### `GET /api/reports/:key/badge.svg`

Returns a shields-style SVG badge showing the latest version's overall gate status (`passing`, `warning`, `failing`, or `no gate`).

Access: open when the dashboard is public; otherwise requires `?token=<uploadToken>` (the token configured in Settings) or an authenticated session. Responds `Content-Type: image/svg+xml`.

#### `GET /api/reports/:key/versions/:versionId/file/*`

Streams a file from the stored archive (or the single uploaded file) for a specific version. Path-traversal-safe.

#### `POST /api/reports`

Uploads a new ReportVersion. If the `key` does not yet exist, the Report is created first. **multipart/form-data** with two parts:

Quality gates: after the processor produces the metrics, the report's gate rules are evaluated and the version carries `gateStatus` (`pass`/`warn`/`fail` or `null`) plus `gateResults`. When the overall status is `fail` and the `webhookUrl` setting is configured, a JSON payload is POSTed to it:

```json
{
  "event": "quality.gate.failed",
  "report": { "key": "my-team/my-app/unit-tests", "displayName": "Unit tests" },
  "version": {
    "id": "01HZX...",
    "processor": "jest-html-reporter",
    "dateCreated": "2026-05-16T10:00:00.000Z"
  },
  "gate": {
    "status": "fail",
    "results": [
      { "ruleId": "01H...", "metric": "tests.failed", "operator": "<=", "value": 2, "status": "fail" }
    ]
  },
  "metrics": [{ "name": "tests.failed", "type": "count", "value": 2 }]
}
```

Delivery is best-effort (10s timeout, failures logged and ignored): a webhook problem never fails the upload.

| Field  | Required | Description                                                    |
| ------ | -------- | -------------------------------------------------------------- |
| `meta` | yes      | JSON describing the upload (see below)                         |
| `file` | optional | The report file or archive (`.zip`, `.tar.gz`, or single file) |

`meta` JSON:

```json
{
  "key": "my-team/my-app/unit-tests",
  "displayName": "Unit tests",
  "processor": "jest-html-reporter",
  "jsonPayload": { "...": "passed to JSON-aware processors" }
}
```

- `key` is **required** and must match `^[a-zA-Z0-9._:\-/]{1,200}$`. It is the unique identifier of the Report; same `key` ⇒ new version.
- `displayName` is optional. If provided, it updates the Report's display name.
- Tags are **not** sent on upload. Manage them via the `/api/tags` endpoints.

Auth: either an authenticated user (JWT in `Authorization: Bearer ...`) **or** a valid upload token in the `X-Upload-Token` header. When the dashboard is set to public read mode, only writes need auth.

##### curl examples

```bash
# 1) Single HTML file (jest-html-reporter)
curl -X POST "$API/reports" \
  -H "X-Upload-Token: $UPLOAD_TOKEN" \
  -F 'meta={"key":"my-team/my-app/unit-tests","displayName":"Unit tests","processor":"jest-html-reporter"};type=application/json' \
  -F file=@./test-report.html

# 2) Coverage as a tar.gz archive (lcov-coverage)
curl -X POST "$API/reports" \
  -H "X-Upload-Token: $UPLOAD_TOKEN" \
  -F 'meta={"key":"my-team/my-app/coverage","processor":"lcov-coverage"};type=application/json' \
  -F file=@./coverage.tar.gz

# 3) Pure JSON metrics (no file)
curl -X POST "$API/reports" \
  -H "X-Upload-Token: $UPLOAD_TOKEN" \
  -F 'meta={"key":"my-team/my-app/summary","processor":"json","jsonPayload":{"metrics":[{"name":"tests.passed","type":"count","value":42},{"name":"tests.coverage","type":"percentage","value":87.3}]}};type=application/json'
```

##### Error responses

Payload and content problems return **400** with a body that self-explains what was wrong:

```json
{
  "error": "json: payload must include a 'metrics' array",
  "processor": "json",
  "field": "metrics",
  "expected": "array of { name: string, type: 'count'|'percentage'|'duration'|'boolean', value: number }",
  "hint": "curl -F 'meta={\"key\":\"...\",\"processor\":\"json\",\"jsonPayload\":{\"metrics\":[...]}};type=application/json' <url>/api/reports"
}
```

- `error` (always present): human-readable message.
- `processor`: the processor that rejected the payload (when known).
- `field`: the offending field (e.g. `key`, `meta`, `processor`, `metrics[2].type`).
- `expected`: the expected format of that field.
- `hint`: an optional remediation hint (e.g. a ready-to-run curl).

#### `DELETE /api/reports`

Deletes all reports (and all versions). Requires authentication.

### Tags

Tags are `tag=value` pairs attached to a Report (one value per `(reportKey, tag)`). They apply to **all** past and future versions of that Report.

#### `GET /api/tags`

Returns an aggregate of every tag and the values it has across reports:

```json
{
  "tags": [
    { "tag": "team", "values": ["platform", "app"] },
    { "tag": "env", "values": ["prod", "staging"] }
  ]
}
```

#### `GET /api/tags/reports/:key`

Returns the tags attached to a Report.

#### `PUT /api/tags/reports/:key`

Replaces all tags of a Report. Body: `{ "tags": [{ "tag": "team", "value": "platform" }, ...] }`. Requires authentication.

#### `PUT /api/tags/reports/:key/:tag`

Sets (or updates) a single tag. Body: `{ "value": "..." }`. Requires authentication.

#### `DELETE /api/tags/reports/:key/:tag`

Removes a single tag from a Report. Requires authentication.

### Dashboards

A Dashboard is a saved view defined by an ordered list of **levels**. Each level has a `tag` and an optional `value`:

- `{ "tag": "team" }` — group by every value of `team` (one branch per value).
- `{ "tag": "env", "value": "prod" }` — keep only reports with `env=prod` (single branch).

Levels are evaluated top-down; reports flow into the matching branch and are aggregated at every level (latest version per report).

#### `GET /api/dashboards`

Lists dashboards.

#### `GET /api/dashboards/:id`

Returns a single dashboard definition.

#### `GET /api/dashboards/:id/aggregate`

Returns the aggregated tree built from the **latest version** of every matching report:

```json
{
  "dashboard": {
    "id": "...",
    "name": "...",
    "levels": [{ "tag": "team" }, { "tag": "env" }]
  },
  "tree": [
    {
      "label": "team=platform",
      "level": 0,
      "reportKeys": ["my-team/my-app/unit-tests", "my-team/my-app/coverage"],
      "metrics": [{ "name": "tests.passed", "type": "count", "value": 84 }],
      "children": [
        {
          "label": "env=prod",
          "level": 1,
          "reportKeys": ["my-team/my-app/unit-tests"],
          "metrics": [{ "name": "tests.passed", "type": "count", "value": 42 }],
          "children": []
        }
      ]
    }
  ]
}
```

Aggregation rule: `count` and `duration` are **summed**, `percentage` and `boolean` are **averaged**.

#### `POST /api/dashboards`

Creates a dashboard. Body: `{ "name": "...", "levels": [...] }`. Requires authentication.

#### `PUT /api/dashboards/:id`

Updates a dashboard. Body: `{ "name": "...", "levels": [...] }`. Requires authentication.

#### `DELETE /api/dashboards/:id`

Deletes a dashboard. Requires authentication.

## Processors

A processor is a JavaScript module placed in:

- `/opt/app/processors_system/` — built-in processors (do not edit)
- `${PROCESSORS_USER_DIR}` (default `/opt/data/processors`) — your custom processors. Files are hot-reloaded on change.

The processor name is the file name without `.js` extension. Custom processors override system ones with the same name.

### Contract

```javascript
module.exports = {
  // Optional metadata returned by GET /api/reports/processors
  describe: () => ({
    name: "my-processor",
    accepts: ["html", "tar.gz"],
    summary: "Short human description",
  }),

  // Required: analyse a report and return metrics + file entrypoint
  analyse: async (ctx) => {
    // ctx fields:
    //   ctx.reportDir   - absolute path of the extracted report directory (always present, may be empty)
    //   ctx.fileName    - original uploaded filename (or undefined)
    //   ctx.jsonPayload - parsed jsonPayload from `meta` (or undefined)
    return {
      // Optional: file inside reportDir to display when clicking the report card
      fileEntrypoint: "report.html",

      // Required: array of metrics
      metrics: [
        { name: "tests.passed", type: "count", value: 42 },
        { name: "tests.coverage", type: "percentage", value: 87.3 },
        { name: "build.duration_ms", type: "duration", value: 1234 },
        { name: "build.green", type: "boolean", value: true },
      ],

      // Optional: arbitrary JSON kept alongside the report
      info: { source: "my-processor" },
    };
  },
};
```

Metric types and aggregation in dashboards:

| Type         | Aggregated as            |
| ------------ | ------------------------ |
| `count`      | sum across the group     |
| `duration`   | sum across the group     |
| `percentage` | average across the group |
| `boolean`    | average across the group |

Aggregation always applies to the **latest version** of each matching report.

### Built-in processors

- `jest-html-reporter` — HTML output of `jest-html-reporter` → `tests.total`, `tests.passed`, `tests.failed`, `tests.pending`
- `lcov-coverage` — HTML output of `lcov` (`index.html`) → `coverage.lines`, `coverage.functions`, `coverage.branches` (`percentage`)
- `popeye-html` — Popeye HTML report → counts of issues by severity
- `trivy-html` — Trivy HTML report → counts of vulnerabilities by severity
- `json` — Pass-through. Expects `jsonPayload.metrics` matching the contract above

## Authentication

- **First user** is created without auth via `POST /api/users`.
- Subsequent operations use `Authorization: Bearer <jwt>` obtained from `POST /api/users/login`.
- An **upload token** can be configured via the settings page; it allows CI jobs to upload without a user account by sending `X-Upload-Token: <token>`.
- Read access is governed by the _Public Dashboard_ setting. When public, anyone can read reports.
- A **webhook URL** can be configured via the settings page; a JSON payload is POSTed to it whenever a report version fails its quality gate (leave empty to disable).

## Tests

Integration tests live under `tests/integration`:

```bash
cd quality-dashboard-server
npm install
npm run dev   # start the server in another shell

cd tests/integration
npm install
npm test
```
