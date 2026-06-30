import { presetToRange, buildLocationsUrl, formatRelative } from "./location-range.js";

const REFRESH_MS = 60000; // refetch the active view every minute
const TICK_MS = 30000; // re-render the "last seen" label between fetches

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

let activePreset = "today"; // null when a manual range is in effect
let latestRecordedAt = null;
let latestPointCount = 0;

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

function updateStatus() {
  if (!latestRecordedAt) {
    return;
  }
  const relative = formatRelative(latestRecordedAt, new Date());
  const noun = latestPointCount === 1 ? "point" : "points";
  statusEl.textContent = `Last seen ${relative} · ${latestPointCount} ${noun}`;
}

function render(points, fitView) {
  trailLayer.clearLayers();
  if (points.length === 0) {
    latestRecordedAt = null;
    statusEl.textContent = "No location data for this range.";
    return;
  }

  const latLngs = points.map((p) => [p.latitude, p.longitude]);
  L.polyline(latLngs, { color: "#2563eb", weight: 4, opacity: 0.7 }).addTo(trailLayer);

  const last = points[points.length - 1];
  L.marker([last.latitude, last.longitude], { icon: arrowIcon(last.heading) }).addTo(trailLayer);

  if (fitView) {
    map.fitBounds(latLngs, { padding: [30, 30], maxZoom: 12 });
  }

  latestRecordedAt = new Date(last.recorded_at);
  latestPointCount = points.length;
  updateStatus();
}

async function load(start, end, fitView = true) {
  startInput.value = toInputValue(start);
  endInput.value = toInputValue(end);
  if (!latestRecordedAt) {
    statusEl.textContent = "Loading location…";
  }
  try {
    const response = await fetch(buildLocationsUrl(start, end));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    render(data.points || [], fitView);
  } catch (error) {
    statusEl.textContent = `Could not load location (${error.message}).`;
  }
}

function refresh() {
  // Re-fetch the current view without disturbing the map's pan/zoom.
  if (activePreset) {
    const { start, end } = presetToRange(activePreset, new Date());
    load(start, end, false);
    return;
  }
  const start = new Date(startInput.value);
  const end = new Date(endInput.value);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    load(start, end, false);
  }
}

function setActivePreset(preset) {
  presetButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.preset === preset));
  });
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activePreset = button.dataset.preset;
    setActivePreset(activePreset);
    const { start, end } = presetToRange(activePreset, new Date());
    load(start, end);
  });
});

function onManualRangeChange() {
  activePreset = null;
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

// Initial view: last 24 hours, then keep it live.
const initial = presetToRange("today", new Date());
load(initial.start, initial.end);
setInterval(refresh, REFRESH_MS);
setInterval(updateStatus, TICK_MS);
