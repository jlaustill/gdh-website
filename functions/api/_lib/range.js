export const TARGET_POINTS = 2000;
export const DEFAULT_RANGE_HOURS = 24;

// Pick a time-bucket size so the range yields at most ~TARGET_POINTS points.
// For narrow ranges the bucket is smaller than the logging interval, so every
// point survives (full detail); for wide ranges it grows, downsampling the
// trail evenly across the whole window while always keeping the latest point.
export function bucketSeconds(startIso, endIso, targetPoints = TARGET_POINTS) {
  const rangeSeconds = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000;
  if (!Number.isFinite(rangeSeconds) || rangeSeconds <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(rangeSeconds / targetPoints));
}

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
