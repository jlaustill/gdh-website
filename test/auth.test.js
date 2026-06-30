import { describe, it, expect } from "vitest";
import { isAuthorized } from "../functions/api/_lib/auth.js";

const TOKEN = "amber-diesel-route-9";

describe("isAuthorized", () => {
  it("accepts a correct Bearer token", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isAuthorized("Bearer nope", TOKEN)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorized(null, TOKEN)).toBe(false);
  });

  it("rejects when no expected token is configured", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, undefined)).toBe(false);
  });

  it("rejects a header without the Bearer prefix", () => {
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false);
  });
});
