import { describe, it, expect } from "vitest";
import { parseLocationBody } from "../functions/api/_lib/parseLocation.js";

describe("parseLocationBody", () => {
  it("parses a full GPSLogger payload", () => {
    const row = parseLocationBody({
      lat: 46.5891,
      lon: -112.0391,
      time: "2026-06-30T14:23:01.000Z",
      acc: 5,
      spd: 27.3,
      dir: 91.2,
    });
    expect(row).toEqual({
      recordedAt: "2026-06-30T14:23:01.000Z",
      latitude: 46.5891,
      longitude: -112.0391,
      accuracy: 5,
      speed: 27.3,
      heading: 91.2,
    });
  });

  it("coerces numeric strings", () => {
    const row = parseLocationBody({ lat: "46.5", lon: "-112.0", time: "2026-06-30T00:00:00Z" });
    expect(row.latitude).toBe(46.5);
    expect(row.longitude).toBe(-112.0);
  });

  it("defaults missing acc/spd/dir to null", () => {
    const row = parseLocationBody({ lat: 46.5, lon: -112.0, time: "2026-06-30T00:00:00Z" });
    expect(row.accuracy).toBeNull();
    expect(row.speed).toBeNull();
    expect(row.heading).toBeNull();
  });

  it("uses fallbackTime when time is missing", () => {
    const row = parseLocationBody({ lat: 46.5, lon: -112.0 }, "2026-06-30T09:00:00.000Z");
    expect(row.recordedAt).toBe("2026-06-30T09:00:00.000Z");
  });

  it("throws when lat/lon are missing", () => {
    expect(() => parseLocationBody({ time: "2026-06-30T00:00:00Z" })).toThrow();
  });

  it("throws when lat/lon are out of range", () => {
    expect(() => parseLocationBody({ lat: 200, lon: 0 })).toThrow();
  });

  it("throws when payload is not an object", () => {
    expect(() => parseLocationBody("nope")).toThrow();
  });
});
