import { describe, it, expect } from "vitest";
import { parseLocationBody, repairEmptyValues } from "../functions/api/_lib/parseLocation.js";

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

describe("repairEmptyValues", () => {
  it("fills empty placeholders before a comma or brace with null", () => {
    const broken = '{"lat":46.5,"lon":-112.0,"time":"2026-06-30T17:00:00.000Z","acc":,"spd":,"dir":}';
    const repaired = repairEmptyValues(broken);
    expect(JSON.parse(repaired)).toEqual({
      lat: 46.5,
      lon: -112.0,
      time: "2026-06-30T17:00:00.000Z",
      acc: null,
      spd: null,
      dir: null,
    });
  });

  it("leaves a valid body unchanged", () => {
    const valid = '{"lat":46.5,"lon":-112.0,"time":"2026-06-30T17:00:00.000Z","acc":5,"spd":0,"dir":90}';
    expect(repairEmptyValues(valid)).toBe(valid);
  });

  it("does not corrupt timestamps containing colons", () => {
    const body = '{"time":"2026-06-30T17:12:10.000Z","dir":}';
    expect(JSON.parse(repairEmptyValues(body))).toEqual({
      time: "2026-06-30T17:12:10.000Z",
      dir: null,
    });
  });

  it("produces a body our parser accepts end to end", () => {
    const broken = '{"lat":43.526,"lon":-112.022,"time":"2026-06-30T17:12:10.000Z","acc":9.9,"spd":,"dir":}';
    const row = parseLocationBody(JSON.parse(repairEmptyValues(broken)));
    expect(row.latitude).toBe(43.526);
    expect(row.speed).toBeNull();
    expect(row.heading).toBeNull();
  });
});
