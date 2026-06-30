# Live Truck Location with Breadcrumb Trail — Design

**Date:** 2026-06-30
**Status:** Approved, pending implementation plan

## Purpose

Show Great Divide Hotshot's truck location on the public website as a map with a
**breadcrumb trail**, so potential brokers can see not only where the truck is, but
which direction it is heading and its recent route. Location data comes from the
**GPSLogger for Android** app (Mendhak, open source) running on the truck's head
unit, which POSTs each new GPS fix to a custom URL.

## Constraints & Context

- Site is hosted on **Cloudflare Pages**, deployed via `wrangler pages deploy`.
- Static HTML (`index.html`), no build step, vanilla JS (`age.js`).
- Must stay on the **free tier** ($0).
- CSP is strict: `default-src 'none'`, everything `'self'`.
- Owner already uses and likes **Leaflet** (in the `gdh-extension` project).
- Bearer token must be **short / typeable** — it gets thumb-typed into a head unit.

## Why D1 (not KV)

- Breadcrumb trail = many points over time → relational/append model fits.
- D1 free tier: 100,000 row writes/day, 5M row reads/day, 5 GB storage. A single
  truck at ~50 bytes/row accumulates ~40–50 MB/year — years of headroom.
- KV's free tier caps at **1,000 writes/day**, which is tight for frequent posting;
  D1 removes that ceiling and gives queryable history for free.

## Architecture

No separate backend service. Two Cloudflare **Pages Functions** + one **D1**
database, all within this repo, deployed by the existing `wrangler pages deploy`.

```
gpslogger (phone)  ──POST /api/location──▶  Pages Function ──▶ D1 (insert row)
website map        ──GET  /api/locations─▶  Pages Function ──▶ D1 (select range)
```

## Components

### Write endpoint — `POST /api/location` (`functions/api/location.js`)

- Validates `Authorization: Bearer <token>` against a Cloudflare **secret**
  (`LOCATION_TOKEN`). Returns **401** if missing or wrong.
- Parses GPSLogger's JSON body and inserts one row into D1.
- GPSLogger app configuration:
  - Method: `POST`
  - Body (using GPSLogger placeholders):
    ```json
    {"lat":%LAT,"lon":%LON,"time":"%TIME","acc":%ACC,"spd":%SPD,"dir":%DIR}
    ```
  - Header: `Authorization: Bearer <short passphrase>`
  - Time interval + **minimum distance filter** set on-device (distance filter
    means parked = no posts = no writes).

### Read endpoint — `GET /api/locations?start=<iso>&end=<iso>` (`functions/api/locations.js`)

- Public, read-only. Returns points within `[start, end]` as JSON, ordered
  oldest → newest.
- **Capped** at a sane maximum (e.g. 5,000 points) so an "All" query over a long
  history cannot blow up the page or the response.

### Database (`schema.sql`)

```sql
CREATE TABLE locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT    NOT NULL,   -- ISO timestamp from gpslogger
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  accuracy    REAL,
  speed       REAL,               -- informational
  heading     REAL                -- bearing; used to rotate the marker
);
CREATE INDEX idx_locations_recorded_at ON locations (recorded_at);
```

`heading` is stored so the current-position marker can render as an **arrow
pointing in the direction of travel** — the core broker value.

### Front end (new section in `index.html`)

- A **"Where's the Truck"** map section rendered with **Leaflet**:
  - **Polyline breadcrumb** across the points in range.
  - **Arrow marker** at the most recent point, rotated by `heading`.
- **History controls** (long history, owner's choice):
  - Preset buttons: **Today / 7 days / 30 days / All**.
  - Presets **set the date range** (single source of truth); explicit date inputs
    can be hand-tweaked. Changing either refetches `/api/locations`.
- **Leaflet is self-hosted** (vendored into `/vendor/leaflet/`), not loaded from a
  CDN — keeps the CSP all-`'self'` for scripts, no third-party script origin.

### CSP changes (`_headers`)

- `img-src`: add `https://*.tile.openstreetmap.org` (map tiles).
- `style-src`: add `'self'` (vendored `leaflet.css`).
- `connect-src`: already `'self'` — covers the `/api/locations` fetch, no change.

### Configuration & secret

- `wrangler.toml`: add the D1 binding.
- Secret: `wrangler pages secret put LOCATION_TOKEN` — a short, typeable
  passphrase (~4 words or ~12–16 lowercase chars). Enough entropy for a
  casual-spoofing threat model; never appears in the URL or logs.
- One-time setup: create the D1 database and apply `schema.sql`.

## Security model

- **Write** endpoint requires the bearer token; threat model is casual spoofing /
  bots scanning for open endpoints, not a determined offline attacker — hence a
  short passphrase is acceptable.
- **Read** endpoint is intentionally public (the website consumes it).
- Token stored as a Cloudflare secret, rotatable if leaked.

## Out of scope (YAGNI)

- No auto-deletion / TTL of old points (5 GB lasts years; long history is desired).
- No websockets / real-time push — the map refetches on load and on range change.
- No rate limiting beyond the bearer token.
- No date-picker "advanced" beyond the preset-driven range inputs.

## Success criteria

- GPSLogger POSTs are accepted (200) with the token and rejected (401) without it.
- Each accepted POST adds one row to D1.
- The website map shows the breadcrumb for the selected range with an arrow marker
  pointing in the direction of travel.
- Preset buttons update the visible range and refetch.
- Everything runs on the Cloudflare free tier and deploys via `wrangler pages deploy`.
- CSP remains strict; only the documented additions are made.
