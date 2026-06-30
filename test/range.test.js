import { describe, it, expect } from "vitest";
import { parseRange, MAX_POINTS, DEFAULT_RANGE_HOURS } from "../functions/api/_lib/range.js";

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
    expect(MAX_POINTS).toBe(5000);
    expect(DEFAULT_RANGE_HOURS).toBe(24);
  });
});
