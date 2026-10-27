import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/format";

describe("formatDate", () => {
  const now = new Date(2026, 9, 27, 12);
  it("shows the Gregorian day and month, whatever the device's calendar", () => {
    expect(formatDate(new Date(2026, 9, 27, 9, 5).toISOString(), now)).toBe("27 Oct");
  });
  it("adds the year outside the current one", () => {
    expect(formatDate(new Date(2025, 0, 3).toISOString(), now)).toBe("3 Jan 2025");
  });
  it("joins the date and the time", () => {
    expect(formatDateTime(new Date(2026, 9, 27, 9, 5).toISOString(), now)).toMatch(
      /^27 Oct at \d/,
    );
  });
});
