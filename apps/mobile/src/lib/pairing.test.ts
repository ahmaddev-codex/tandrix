import { pairingLink } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { codeFromScan } from "./pairing";

describe("codeFromScan", () => {
  it("reads the code from the Mac's QR", () => {
    expect(codeFromScan(pairingLink("K7P4QXJ9"))).toBe("K7P4QXJ9");
  });

  it("ignores other QR codes and malformed links", () => {
    expect(codeFromScan("https://example.com/pair?code=K7P4QXJ9")).toBeNull();
    expect(codeFromScan("tandrix://pair?code=SHORT")).toBeNull();
    expect(codeFromScan("tandrix://pair?code=K7P4QXJ9&next=evil")).toBeNull();
    expect(codeFromScan("WIFI:S:home;P:secret;;")).toBeNull();
  });
});
