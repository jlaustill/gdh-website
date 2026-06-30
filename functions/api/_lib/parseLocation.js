export function repairEmptyValues(jsonText) {
  // GPSLogger replaces unavailable placeholders (e.g. speed/bearing when the
  // device is stationary) with an empty string, producing invalid JSON like
  // {"spd":,"dir":}. Replace any value left empty before a comma or closing
  // brace with null so the body parses. A real number never sits directly
  // before a comma/brace, so valid bodies are unaffected.
  return jsonText.replace(/:(\s*)([,}])/g, ":null$1$2");
}

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
