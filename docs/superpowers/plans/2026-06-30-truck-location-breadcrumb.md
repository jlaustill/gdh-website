# Live Truck Location with Breadcrumb Trail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the truck's live location and recent breadcrumb trail on the public website, fed by the GPSLogger Android app and stored in Cloudflare D1.

**Architecture:** Two Cloudflare Pages Functions (`POST /api/location` to ingest, `GET /api/locations` to serve a range) read/write a D1 table. The static `index.html` renders the trail with self-hosted Leaflet. Pure logic (auth, body parsing, range math) is extracted into `_lib` modules and unit-tested with Vitest; handler glue and the map UI are verified live with `wrangler pages dev`.

**Tech Stack:** Cloudflare Pages Functions, Cloudflare D1 (SQLite), Leaflet 1.9.4 (self-hosted), Vitest (dev only), vanilla ESM JS.

## Global Constraints

- Hosting: Cloudflare Pages, deploy via `wrangler pages deploy`. No build step for the site.
- Must stay on the **free tier** ($0).
- CSP is strict (`default-src 'none'`, everything `'self'`); only the documented additions are allowed.
- Leaflet is **self-hosted** under `vendor/leaflet/` — no CDN script/style origins.
- Bearer token secret name: `LOCATION_TOKEN`. D1 binding name: `DB`. D1 database name: `gdh-locations`.
- Functions are ESM (`export async function onRequest...`). `_lib` modules use ESM `export`.
- Naming: spell words out, no invented abbreviations (per repo owner convention).
- Pin Leaflet to **1.9.4**.

---

### Task 1: Test harness + bearer-token auth helper

**Files:**
- Modify: `package.json` (add Vitest devDep + test scripts)
- Create: `vitest.config.mjs`
- Create: `functions/api/_lib/auth.js`
- Test: `test/auth.test.js`

**Interfaces:**
- Produces: `isAuthorized(authHeader: string | null, expectedToken: string | undefined) => boolean`

- [ ] **Step 1: Install Vitest as a dev dependency**

Run:
```bash
npm install --save-dev vitest@^3
```
Expected: `package.json` gains `vitest` under `devDependencies`; no errors.

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, add to the `"scripts"` block (keep existing `deploy`/`preview`):
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.mjs`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Write the failing test** in `test/auth.test.js`

```js
import { describe, it, expect } from "vitest";
import { isAuthorized } from "../functions/api/_lib/auth.js";

const TOKEN = "amber-diesel-route-9";

describe("isAuthorized", () => {
  it("accepts a correct Bearer token", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isAuthorized("Bearer nope", TOKEN)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorized(null, TOKEN)).toBe(false);
  });

  it("rejects when no expected token is configured", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, undefined)).toBe(false);
  });

  it("rejects a header without the Bearer prefix", () => {
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../functions/api/_lib/auth.js`.

- [ ] **Step 6: Implement `functions/api/_lib/auth.js`**

```js
const BEARER_PREFIX = "Bearer ";

export function isAuthorized(authHeader, expectedToken) {
  if (!expectedToken) {
    return false;
  }
  if (typeof authHeader !== "string" || !authHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const providedToken = authHeader.slice(BEARER_PREFIX.length).trim();
  return providedToken.length > 0 && providedToken === expectedToken;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 5 passing.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.mjs functions/api/_lib/auth.js test/auth.test.js
git commit -m "Add Vitest harness and bearer-token auth helper"
```

---

### Task 2: GPSLogger body parser

**Files:**
- Create: `functions/api/_lib/parseLocation.js`
- Test: `test/parseLocation.test.js`

**Interfaces:**
- Produces: `parseLocationBody(payload: object, fallbackTime?: string) => { recordedAt: string, latitude: number, longitude: number, accuracy: number | null, speed: number | null, heading: number | null }`. Throws `Error` on invalid lat/lon.

- [ ] **Step 1: Write the failing test** in `test/parseLocation.test.js`

```js
import { describe, it, expect } from "vitest";
import { parseLocationBody } from "../functions/api/_lib/parseLocation.js";

describe("parseLocationBody", () => {
  it("parses a full GPSLogger payload", () => {
    const row = parseLocationBody({
      lat: 46.5891,
      lon: -112.0391,
      time: "2026-06-30T14:23:01.000Z",
      acc: 5,
      spd: 27.3,
      dir: 91.2,
    });
    expect(row).toEqual({
      recordedAt: "2026-06-30T14:23:01.000Z",
      latitude: 46.5891,
      longitude: -112.0391,
      accuracy: 5,
      speed: 27.3,
      heading: 91.2,
    });
  });

  it("coerces numeric strings", () => {
    const row = parseLocationBody({ lat: "46.5", lon: "-112.0", time: "2026-06-30T00:00:00Z" });
    expect(row.latitude).toBe(46.5);
    expect(row.longitude).toBe(-112.0);
  });

  it("defaults missing acc/spd/dir to null", () => {
    const row = parseLocationBody({ lat: 46.5, lon: -112.0, time: "2026-06-30T00:00:00Z" });
    expect(row.accuracy).toBeNull();
    expect(row.speed).toBeNull();
    expect(row.heading).toBeNull();
  });

  it("uses fallbackTime when time is missing", () => {
    const row = parseLocationBody({ lat: 46.5, lon: -112.0 }, "2026-06-30T09:00:00.000Z");
    expect(row.recordedAt).toBe("2026-06-30T09:00:00.000Z");
  });

  it("throws when lat/lon are missing", () => {
    expect(() => parseLocationBody({ time: "2026-06-30T00:00:00Z" })).toThrow();
  });

  it("throws when lat/lon are out of range", () => {
    expect(() => parseLocationBody({ lat: 200, lon: 0 })).toThrow();
  });

  it("throws when payload is not an object", () => {
    expect(() => parseLocationBody("nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test test/parseLocation.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `functions/api/_lib/parseLocation.js`**

```js
function toFiniteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLocationBody(payload, fallbackTime) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Body must be a JSON object");
  }

  const latitude = toFiniteNumberOrNull(payload.lat);
  const longitude = toFiniteNumberOrNull(payload.lon);
  if (latitude === null || longitude === null) {
    throw new Error("lat and lon are required and must be numbers");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("lat/lon out of range");
  }

  const hasTime = typeof payload.time === "string" && payload.time.trim().length > 0;
  const recordedAt = hasTime
    ? payload.time.trim()
    : fallbackTime || new Date().toISOString();

  return {
    recordedAt,
    latitude,
    longitude,
    accuracy: toFiniteNumberOrNull(payload.acc),
    speed: toFiniteNumberOrNull(payload.spd),
    heading: toFiniteNumberOrNull(payload.dir),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test test/parseLocation.test.js`
Expected: PASS — 7 passing.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_lib/parseLocation.js test/parseLocation.test.js
git commit -m "Add GPSLogger location body parser"
```

---

### Task 3: Read-endpoint range parser

**Files:**
- Create: `functions/api/_lib/range.js`
- Test: `test/range.test.js`

**Interfaces:**
- Produces:
  - `MAX_POINTS: number` (5000)
  - `DEFAULT_RANGE_HOURS: number` (24)
  - `parseRange(searchParams: URLSearchParams, now: Date) => { start: string, end: string }` — ISO strings; defaults end→now, start→now−24h; swaps if reversed.

- [ ] **Step 1: Write the failing test** in `test/range.test.js`

```js
import { describe, it, expect } from "vitest";
import { parseRange, MAX_POINTS, DEFAULT_RANGE_HOURS } from "../functions/api/_lib/range.js";

const NOW = new Date("2026-06-30T12:00:00.000Z");

describe("parseRange", () => {
  it("uses explicit start and end", () => {
    const params = new URLSearchParams({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-15T00:00:00.000Z",
    });
    expect(parseRange(params, NOW)).toEqual({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-15T00:00:00.000Z",
    });
  });

  it("defaults end to now and start to 24h before end", () => {
    const result = parseRange(new URLSearchParams(), NOW);
    expect(result.end).toBe("2026-06-30T12:00:00.000Z");
    expect(result.start).toBe("2026-06-29T12:00:00.000Z");
  });

  it("swaps start and end when reversed", () => {
    const params = new URLSearchParams({
      start: "2026-06-15T00:00:00.000Z",
      end: "2026-06-01T00:00:00.000Z",
    });
    const result = parseRange(params, NOW);
    expect(result.start).toBe("2026-06-01T00:00:00.000Z");
    expect(result.end).toBe("2026-06-15T00:00:00.000Z");
  });

  it("ignores an unparseable date and falls back", () => {
    const params = new URLSearchParams({ end: "not-a-date" });
    const result = parseRange(params, NOW);
    expect(result.end).toBe("2026-06-30T12:00:00.000Z");
  });

  it("exposes the constants", () => {
    expect(MAX_POINTS).toBe(5000);
    expect(DEFAULT_RANGE_HOURS).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test test/range.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `functions/api/_lib/range.js`**

```js
export const MAX_POINTS = 5000;
export const DEFAULT_RANGE_HOURS = 24;

function parseIsoOrNull(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRange(searchParams, now) {
  let end = parseIsoOrNull(searchParams.get("end")) || now;
  let start =
    parseIsoOrNull(searchParams.get("start")) ||
    new Date(end.getTime() - DEFAULT_RANGE_HOURS * 60 * 60 * 1000);

  if (start.getTime() > end.getTime()) {
    const swap = start;
    start = end;
    end = swap;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test test/range.test.js`
Expected: PASS — 5 passing.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_lib/range.js test/range.test.js
git commit -m "Add read-endpoint range parser"
```

---

### Task 4: Front-end range helpers

**Files:**
- Create: `location-range.js`
- Test: `test/location-range.test.js`

**Interfaces:**
- Produces:
  - `presetToRange(preset: "today"|"7days"|"30days"|"all", now: Date) => { start: Date, end: Date }`
  - `buildLocationsUrl(start: Date, end: Date) => string` (e.g. `/api/locations?start=...&end=...`)

- [ ] **Step 1: Write the failing test** in `test/location-range.test.js`

```js
import { describe, it, expect } from "vitest";
import { presetToRange, buildLocationsUrl } from "../location-range.js";

const NOW = new Date("2026-06-30T12:00:00.000Z");

describe("presetToRange", () => {
  it("today is the last 24 hours", () => {
    const { start, end } = presetToRange("today", NOW);
    expect(end.toISOString()).toBe("2026-06-30T12:00:00.000Z");
    expect(start.toISOString()).toBe("2026-06-29T12:00:00.000Z");
  });

  it("7days is the last 7 days", () => {
    const { start } = presetToRange("7days", NOW);
    expect(start.toISOString()).toBe("2026-06-23T12:00:00.000Z");
  });

  it("30days is the last 30 days", () => {
    const { start } = presetToRange("30days", NOW);
    expect(start.toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });

  it("all starts at the epoch", () => {
    const { start, end } = presetToRange("all", NOW);
    expect(start.getTime()).toBe(0);
    expect(end.toISOString()).toBe("2026-06-30T12:00:00.000Z");
  });
});

describe("buildLocationsUrl", () => {
  it("encodes start and end as ISO query params", () => {
    const url = buildLocationsUrl(
      new Date("2026-06-29T12:00:00.000Z"),
      new Date("2026-06-30T12:00:00.000Z"),
    );
    expect(url).toBe(
      "/api/locations?start=2026-06-29T12%3A00%3A00.000Z&end=2026-06-30T12%3A00%3A00.000Z",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test test/location-range.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `location-range.js`**

```js
const PRESET_HOURS = {
  today: 24,
  "7days": 24 * 7,
  "30days": 24 * 30,
};

export function presetToRange(preset, now) {
  const end = new Date(now.getTime());
  if (preset === "all") {
    return { start: new Date(0), end };
  }
  const hours = PRESET_HOURS[preset] ?? PRESET_HOURS.today;
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}

export function buildLocationsUrl(start, end) {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return `/api/locations?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test test/location-range.test.js`
Expected: PASS — 5 passing.

- [ ] **Step 5: Commit**

```bash
git add location-range.js test/location-range.test.js
git commit -m "Add front-end range preset and URL helpers"
```

---

### Task 5: D1 database, schema, and binding

**Files:**
- Create: `schema.sql`
- Modify: `wrangler.toml` (append D1 binding)

**Interfaces:**
- Produces: D1 binding `DB` available to functions; table `locations` with columns `recorded_at, latitude, longitude, accuracy, speed, heading`.

- [ ] **Step 1: Create `schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT    NOT NULL,
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  accuracy    REAL,
  speed       REAL,
  heading     REAL
);

CREATE INDEX IF NOT EXISTS idx_locations_recorded_at ON locations (recorded_at);
```

- [ ] **Step 2: Create the remote D1 database**

Run:
```bash
npx wrangler d1 create gdh-locations
```
Expected: prints a `database_id`. Copy it for the next step.

- [ ] **Step 3: Append the binding to `wrangler.toml`**

Add to the end of `wrangler.toml` (replace `PASTE_DATABASE_ID_HERE` with the id from Step 2):
```toml

[[d1_databases]]
binding = "DB"
database_name = "gdh-locations"
database_id = "PASTE_DATABASE_ID_HERE"
```

- [ ] **Step 4: Apply the schema locally and remotely**

Run:
```bash
npx wrangler d1 execute gdh-locations --local --file=schema.sql
npx wrangler d1 execute gdh-locations --remote --file=schema.sql
```
Expected: both report the statements executed successfully.

- [ ] **Step 5: Verify the table exists locally**

Run:
```bash
npx wrangler d1 execute gdh-locations --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```
Expected: output includes a row for `locations`.

- [ ] **Step 6: Commit**

```bash
git add schema.sql wrangler.toml
git commit -m "Add D1 database schema and binding"
```

---

### Task 6: Write endpoint — POST /api/location

**Files:**
- Create: `functions/api/location.js`

**Interfaces:**
- Consumes: `isAuthorized` (Task 1), `parseLocationBody` (Task 2), D1 binding `env.DB` (Task 5), secret `env.LOCATION_TOKEN`.
- Produces: HTTP route `POST /api/location` — 401 unauthorized, 400 bad body, 200 on insert.

- [ ] **Step 1: Implement `functions/api/location.js`**

```js
import { isAuthorized } from "./_lib/auth.js";
import { parseLocationBody } from "./_lib/parseLocation.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request.headers.get("Authorization"), env.LOCATION_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  let row;
  try {
    row = parseLocationBody(payload);
  } catch (error) {
    return new Response(error.message, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT INTO locations (recorded_at, latitude, longitude, accuracy, speed, heading) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(row.recordedAt, row.latitude, row.longitude, row.accuracy, row.speed, row.heading)
    .run();

  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 2: Start the local dev server with a test token**

Run (leave running in one terminal):
```bash
LOCATION_TOKEN=test-token npx wrangler pages dev
```
Expected: server starts, typically on `http://localhost:8788`, with the `DB` binding bound to local D1.

> Note: `wrangler pages dev` reads `LOCATION_TOKEN` from the environment for local runs; the production value is set as a real secret in Task 11.

- [ ] **Step 3: Verify a missing token is rejected (401)**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/api/location \
  -H "Content-Type: application/json" \
  -d '{"lat":46.5891,"lon":-112.0391,"time":"2026-06-30T14:23:01.000Z"}'
```
Expected: `401`

- [ ] **Step 4: Verify a valid post is accepted (200) and stored**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/api/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"lat":46.5891,"lon":-112.0391,"time":"2026-06-30T14:23:01.000Z","acc":5,"spd":27.3,"dir":91.2}'

npx wrangler d1 execute gdh-locations --local \
  --command="SELECT recorded_at, latitude, heading FROM locations ORDER BY id DESC LIMIT 1;"
```
Expected: curl prints `200`; the D1 query returns the row just inserted (`2026-06-30T14:23:01.000Z`, `46.5891`, `91.2`).

- [ ] **Step 5: Commit**

```bash
git add functions/api/location.js
git commit -m "Add POST /api/location write endpoint"
```

---

### Task 7: Read endpoint — GET /api/locations

**Files:**
- Create: `functions/api/locations.js`

**Interfaces:**
- Consumes: `parseRange`, `MAX_POINTS` (Task 3), D1 binding `env.DB`.
- Produces: HTTP route `GET /api/locations?start=&end=` → JSON `{ start, end, points: [{ recorded_at, latitude, longitude, accuracy, speed, heading }] }`, oldest→newest, capped at `MAX_POINTS`.

- [ ] **Step 1: Implement `functions/api/locations.js`**

```js
import { parseRange, MAX_POINTS } from "./_lib/range.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { start, end } = parseRange(url.searchParams, new Date());

  const result = await env.DB.prepare(
    "SELECT recorded_at, latitude, longitude, accuracy, speed, heading " +
      "FROM locations WHERE recorded_at >= ? AND recorded_at <= ? " +
      "ORDER BY recorded_at ASC LIMIT ?",
  )
    .bind(start, end, MAX_POINTS)
    .all();

  const body = JSON.stringify({ start, end, points: result.results });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}
```

- [ ] **Step 2: Verify the endpoint returns the stored point**

With `wrangler pages dev` running (from Task 6) and the row inserted in Task 6:
```bash
curl -s "http://localhost:8788/api/locations?start=2026-06-30T00:00:00.000Z&end=2026-06-30T23:59:59.000Z"
```
Expected: JSON with a `points` array containing the inserted location (`latitude: 46.5891`, `heading: 91.2`).

- [ ] **Step 3: Verify the default range works without params**

```bash
curl -s "http://localhost:8788/api/locations" | head -c 200
```
Expected: valid JSON with `start`, `end`, and a `points` array (may be empty if the inserted point is older than 24h — that is correct behavior).

- [ ] **Step 4: Commit**

```bash
git add functions/api/locations.js
git commit -m "Add GET /api/locations read endpoint"
```

---

### Task 8: Vendor Leaflet and update CSP

**Files:**
- Create: `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`, `vendor/leaflet/images/*.png`
- Modify: `_headers` (CSP additions)

**Interfaces:**
- Produces: global `window.L` when `vendor/leaflet/leaflet.js` is loaded; CSP that permits OSM tiles and the vendored stylesheet.

- [ ] **Step 1: Download Leaflet 1.9.4 assets**

Run:
```bash
mkdir -p vendor/leaflet/images
curl -sLo vendor/leaflet/leaflet.js  https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
curl -sLo vendor/leaflet/leaflet.css https://unpkg.com/leaflet@1.9.4/dist/leaflet.css
for img in marker-icon.png marker-icon-2x.png marker-shadow.png layers.png layers-2x.png; do
  curl -sLo "vendor/leaflet/images/$img" "https://unpkg.com/leaflet@1.9.4/dist/images/$img"
done
```

- [ ] **Step 2: Verify the assets downloaded**

Run:
```bash
ls -la vendor/leaflet vendor/leaflet/images
grep -o "1.9.4" vendor/leaflet/leaflet.js | head -1
```
Expected: `leaflet.js`, `leaflet.css` present and non-empty; five PNGs under `images/`; grep prints `1.9.4`.

- [ ] **Step 3: Update the CSP in `_headers`**

Replace the existing `Content-Security-Policy:` line with (changes: `style-src` adds `'self'`; `img-src` adds the OSM tile origin):
```
  Content-Security-Policy: default-src 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; form-action 'self'
```

- [ ] **Step 4: Commit**

```bash
git add vendor/leaflet _headers
git commit -m "Vendor Leaflet 1.9.4 and allow OSM tiles in CSP"
```

---

### Task 9: Add the map section to index.html

**Files:**
- Modify: `index.html` (add stylesheet link in `<head>`, a map section in `<main>`, and CSS)

**Interfaces:**
- Produces: DOM elements `#truck-map`, `#range-start`, `#range-end`, `#map-status`, and buttons `.range-preset[data-preset]`; the Leaflet stylesheet loaded.

- [ ] **Step 1: Add the Leaflet stylesheet link** inside `<head>`, immediately before the opening `<style>` tag (around line 52):

```html
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css">
```

- [ ] **Step 2: Add map styles** at the end of the existing `<style>` block (before `</style>` near line 325):

```css
    /* Truck location map */
    .map-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .range-preset {
      font-size: 12px;
      font-weight: 600;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      letter-spacing: 0.5px;
    }

    .range-preset[aria-pressed="true"] {
      color: #ffffff;
      background: #2563eb;
      border-color: #2563eb;
    }

    .map-range {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #64748b;
      margin-bottom: 12px;
    }

    .map-range input {
      font: inherit;
      margin-left: 6px;
    }

    .truck-map {
      height: 360px;
      width: 100%;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .map-status {
      font-size: 13px;
      color: #64748b;
      margin-top: 10px;
      min-height: 1.2em;
    }
```

- [ ] **Step 3: Add the map section** in `<main>`, immediately before the closing `</main>` tag (after the Partnerships section, around line 410):

```html
    <section class="section section-alt" aria-label="Truck Location">
      <div class="section-label">Where&rsquo;s the Truck</div>
      <div class="map-controls" id="map-controls">
        <button type="button" class="range-preset" data-preset="today" aria-pressed="true">24 Hours</button>
        <button type="button" class="range-preset" data-preset="7days" aria-pressed="false">7 Days</button>
        <button type="button" class="range-preset" data-preset="30days" aria-pressed="false">30 Days</button>
        <button type="button" class="range-preset" data-preset="all" aria-pressed="false">All</button>
      </div>
      <div class="map-range">
        <label>From <input type="datetime-local" id="range-start"></label>
        <label>To <input type="datetime-local" id="range-end"></label>
      </div>
      <div id="truck-map" class="truck-map"></div>
      <p class="map-status" id="map-status">Loading location&hellip;</p>
    </section>
```

- [ ] **Step 4: Add the script tags** just before `</body>` (after the existing `age.js` script, line 426). Order matters — Leaflet first, then the module:

```html
  <script src="vendor/leaflet/leaflet.js" defer></script>
  <script type="module" src="location-map.js"></script>
```

- [ ] **Step 5: Verify the page structure loads** with `wrangler pages dev` running:

```bash
curl -s http://localhost:8788/ | grep -c "truck-map"
```
Expected: `1` (the map container is present).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add truck location map section and styles to index.html"
```

---

### Task 10: Leaflet rendering and control wiring

**Files:**
- Create: `location-map.js`

**Interfaces:**
- Consumes: `presetToRange`, `buildLocationsUrl` (Task 4); global `window.L` (Task 8); DOM ids from Task 9; `GET /api/locations` (Task 7).
- Produces: a working map that draws the breadcrumb polyline + a heading arrow at the latest point, with preset buttons that drive the date inputs and refetch.

- [ ] **Step 1: Implement `location-map.js`**

```js
import { presetToRange, buildLocationsUrl } from "./location-range.js";

const L = window.L;
const HELENA = [46.5891, -112.0391]; // fallback view: home base

const map = L.map("truck-map").setView(HELENA, 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const trailLayer = L.layerGroup().addTo(map);

const startInput = document.getElementById("range-start");
const endInput = document.getElementById("range-end");
const statusEl = document.getElementById("map-status");
const presetButtons = Array.from(document.querySelectorAll(".range-preset"));

function toInputValue(date) {
  // datetime-local needs local "YYYY-MM-DDTHH:mm"
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function arrowIcon(headingDegrees) {
  const rotation = Number.isFinite(headingDegrees) ? headingDegrees : 0;
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html:
      `<div style="width:28px;height:28px;transform:rotate(${rotation}deg);">` +
      `<svg viewBox="0 0 24 24" width="28" height="28">` +
      `<path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"/>` +
      `</svg></div>`,
  });
}

function render(points) {
  trailLayer.clearLayers();
  if (points.length === 0) {
    statusEl.textContent = "No location data for this range.";
    return;
  }

  const latLngs = points.map((p) => [p.latitude, p.longitude]);
  L.polyline(latLngs, { color: "#2563eb", weight: 4, opacity: 0.7 }).addTo(trailLayer);

  const last = points[points.length - 1];
  L.marker([last.latitude, last.longitude], { icon: arrowIcon(last.heading) }).addTo(trailLayer);

  map.fitBounds(latLngs, { padding: [30, 30], maxZoom: 12 });
  const when = new Date(last.recorded_at).toLocaleString();
  statusEl.textContent = `Last update: ${when} (${points.length} points)`;
}

async function load(start, end) {
  startInput.value = toInputValue(start);
  endInput.value = toInputValue(end);
  statusEl.textContent = "Loading location…";
  try {
    const response = await fetch(buildLocationsUrl(start, end));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    render(data.points || []);
  } catch (error) {
    statusEl.textContent = `Could not load location (${error.message}).`;
  }
}

function setActivePreset(preset) {
  presetButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.preset === preset));
  });
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActivePreset(button.dataset.preset);
    const { start, end } = presetToRange(button.dataset.preset, new Date());
    load(start, end);
  });
});

function onManualRangeChange() {
  setActivePreset(null);
  const start = new Date(startInput.value);
  const end = new Date(endInput.value);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return;
  }
  load(start, end);
}

startInput.addEventListener("change", onManualRangeChange);
endInput.addEventListener("change", onManualRangeChange);

// Initial view: last 24 hours
const initial = presetToRange("today", new Date());
load(initial.start, initial.end);
```

- [ ] **Step 2: Re-run the unit tests** (the helper module is shared; confirm nothing broke):

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Seed a few local points and verify the map renders**

With `wrangler pages dev` running, insert a short trail near "now" so the default 24h view shows it:
```bash
npx wrangler d1 execute gdh-locations --local --command="INSERT INTO locations (recorded_at,latitude,longitude,accuracy,speed,heading) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 minutes'),46.59,-112.04,5,20,90),(strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes'),46.62,-111.90,5,22,80),(strftime('%Y-%m-%dT%H:%M:%fZ','now'),46.70,-111.70,5,25,75);"
```
Then open `http://localhost:8788/` in a browser.
Expected: the map shows a blue breadcrumb line through the three points with a blue arrow at the newest point; the status line reads `Last update: …(3 points)`. Clicking **7 Days** updates the date inputs and refetches.

- [ ] **Step 4: Commit**

```bash
git add location-map.js
git commit -m "Add Leaflet rendering and range controls for truck map"
```

---

### Task 11: Production secret, GPSLogger config doc, and end-to-end verification

**Files:**
- Create: `docs/gpslogger-setup.md`

**Interfaces:**
- Consumes: deployed Pages project, `POST /api/location`, `GET /api/locations`.
- Produces: production `LOCATION_TOKEN` secret; setup documentation; a verified live round-trip.

- [ ] **Step 1: Choose a short, typeable token and set it as a production secret**

Run (you will be prompted to paste the value, e.g. `amber-diesel-route-9`):
```bash
npx wrangler pages secret put LOCATION_TOKEN
```
Expected: confirms the secret was created for the Pages project.

- [ ] **Step 2: Deploy**

Run:
```bash
npm run deploy
```
Expected: deploy succeeds; note the production URL (e.g. `https://greatdividehotshot.com`).

- [ ] **Step 3: Verify the live write + read round-trip**

Replace `<TOKEN>` and `<SITE>` with your real values:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://<SITE>/api/location" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"lat":46.5891,"lon":-112.0391,"time":"2026-06-30T15:00:00.000Z","acc":5,"spd":0,"dir":0}'

curl -s "https://<SITE>/api/locations?start=2026-06-30T00:00:00.000Z&end=2026-06-30T23:59:59.000Z"
```
Expected: POST returns `200`; GET returns JSON containing the point.

- [ ] **Step 4: Write `docs/gpslogger-setup.md`**

```markdown
# GPSLogger Setup (Android head unit)

Configure GPSLogger (Mendhak) → **Logging details → Log to custom URL**:

- **Enable** "Log to custom URL".
- **URL:** `https://greatdividehotshot.com/api/location`
- **HTTP Method:** `POST`
- **HTTP Body:**
  ```json
  {"lat":%LAT,"lon":%LON,"time":"%TIME","acc":%ACC,"spd":%SPD,"dir":%DIR}
  ```
- **HTTP Headers:**
  ```
  Authorization: Bearer amber-diesel-route-9
  Content-Type: application/json
  ```
  (Replace the token with the real value set via `wrangler pages secret put LOCATION_TOKEN`.)

## Performance / battery settings

- **Time between fixes:** 60 seconds (or more) — keeps writes well within free tier.
- **Distance filter:** set a minimum distance (e.g. 100 m) so a parked truck stops
  posting. Writes only happen while moving.
- Offline points are queued and sent when signal returns.

## Rotating the token

1. `npx wrangler pages secret put LOCATION_TOKEN` (set a new value).
2. `npm run deploy`.
3. Update the `Authorization` header in GPSLogger to match.
```

- [ ] **Step 5: Commit**

```bash
git add docs/gpslogger-setup.md
git commit -m "Add GPSLogger setup documentation"
```

- [ ] **Step 6: Final full test run**

Run: `npm test`
Expected: PASS — all suites green (auth, parseLocation, range, location-range).

---

## Self-Review

**Spec coverage:**
- Architecture (Pages Functions + D1, same deploy) → Tasks 5–7. ✓
- Write endpoint with bearer auth → Tasks 1, 6. ✓
- Read endpoint with range + cap → Tasks 3, 7. ✓
- D1 schema incl. heading → Task 5. ✓
- Leaflet breadcrumb + arrow marker → Tasks 8, 10. ✓
- Preset buttons drive date range → Tasks 4, 9, 10. ✓
- Self-hosted Leaflet → Task 8. ✓
- CSP additions (img tiles, style 'self') → Task 8. ✓
- Secret + config → Tasks 5, 11. ✓
- GPSLogger JSON body + headers → Task 11 doc. ✓
- Out-of-scope items (no TTL, no websockets, no extra rate limiting) → respected. ✓

**Type consistency:** API JSON uses snake_case D1 column names (`recorded_at`, `latitude`, …) consistently in the read endpoint (Task 7) and the front end (`location-map.js`, Task 10 reads `p.latitude`, `p.recorded_at`, `p.heading`). Helper signatures match across consume/produce blocks (`isAuthorized`, `parseLocationBody`, `parseRange`/`MAX_POINTS`, `presetToRange`/`buildLocationsUrl`). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; `PASTE_DATABASE_ID_HERE`, `<TOKEN>`, `<SITE>` are intentional user-supplied values with explicit instructions, not plan gaps. ✓
