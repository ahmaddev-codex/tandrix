import { describe, expect, it } from "vitest";
import { formatPairingCode, pairingLink, PairingCode, PairingCodeRequest } from "../src";

describe("PairingCode", () => {
  it("accepts typed variations of a code", () => {
    expect(PairingCode.parse("k7p4-qxj9")).toBe("K7P4QXJ9");
    expect(PairingCode.parse(" K7P4 QXJ9 ")).toBe("K7P4QXJ9");
    // O and I/L are never issued; read as 0 and 1.
    expect(PairingCode.parse("O0IL-ABCD")).toBe("0011ABCD");
  });

  it("refuses codes of the wrong length or with letters it never issues", () => {
    expect(PairingCode.safeParse("K7P4QXJ").success).toBe(false);
    expect(PairingCode.safeParse("K7P4QXJ99").success).toBe(false);
    expect(PairingCode.safeParse("K7P4QXJU").success).toBe(false);
    expect(PairingCodeRequest.safeParse({ code: "K7P4QXJ9", extra: 1 }).success).toBe(false);
  });

  it("formats and links codes the way the Mac shows them", () => {
    expect(formatPairingCode("K7P4QXJ9")).toBe("K7P4-QXJ9");
    expect(pairingLink("K7P4QXJ9")).toBe("tandrix://pair?code=K7P4QXJ9");
  });
});
