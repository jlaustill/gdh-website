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
