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
