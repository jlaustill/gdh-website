import { describe, it, expect } from "vitest";
import { parseRange, TARGET_POINTS, DEFAULT_RANGE_HOURS, bucketSeconds } from "../functions/api/_lib/range.js";

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
    expect(TARGET_POINTS).toBe(2000);
    expect(DEFAULT_RANGE_HOURS).toBe(24);
  });
});

describe("bucketSeconds", () => {
  it("keeps full detail when the range is small relative to target", () => {
    // 24h / 2000 = 43.2 -> 44s, smaller than the 60s logging interval
    expect(bucketSeconds("2026-06-29T12:00:00.000Z", "2026-06-30T12:00:00.000Z", 2000)).toBe(44);
  });

  it("grows the bucket for wide ranges", () => {
    // 30 days = 2,592,000s / 2000 = 1296s (~21.6 min)
    expect(bucketSeconds("2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z", 2000)).toBe(1296);
  });

  it("never returns less than 1 second", () => {
    expect(bucketSeconds("2026-06-30T12:00:00.000Z", "2026-06-30T12:00:00.000Z", 2000)).toBe(1);
  });
});
