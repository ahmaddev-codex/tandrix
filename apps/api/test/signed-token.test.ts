import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../src/signed-token";

const S = "s".repeat(32);
const fields = ["manual", "user-a", "flowset|cr 3-10", "https://maker.example/m.pdf"];

describe("signed tokens", () => {
  it("verifies a token for the same fields before it expires", () => {
    const t = signToken(S, fields, 2000);
    expect(verifyToken(S, fields, t, 1000)).toBe(true);
  });

  it("rejects it after expiry", () => {
    expect(verifyToken(S, fields, signToken(S, fields, 2000), 2001)).toBe(false);
  });

  it("rejects any changed field: another user, model or URL", () => {
    const t = signToken(S, fields, 2000);
    for (let i = 0; i < fields.length; i++) {
      const changed = fields.map((f, j) => (j === i ? `${f}x` : f));
      expect(verifyToken(S, changed, t, 1000)).toBe(false);
    }
  });

  it("rejects a token signed with another secret", () => {
    expect(verifyToken(S, fields, signToken("t".repeat(32), fields, 2000), 1000)).toBe(false);
  });

  it("rejects an extended expiry", () => {
    const [, mac] = signToken(S, fields, 2000).split(".");
    expect(verifyToken(S, fields, `9999999999999.${mac}`, 1000)).toBe(false);
  });

  it.each(["", ".", "abc", "1000", "x.y", "1000.", ".mac"])("rejects malformed %j", (t) => {
    expect(verifyToken(S, fields, t, 0)).toBe(false);
  });
});
