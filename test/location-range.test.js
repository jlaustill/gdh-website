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
