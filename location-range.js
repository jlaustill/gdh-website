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

export function formatRelative(date, now) {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function buildLocationsUrl(start, end) {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return `/api/locations?${params.toString()}`;
}
