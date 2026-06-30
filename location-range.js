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
