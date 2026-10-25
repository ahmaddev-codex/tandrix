import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ net: {}, protocol: {} }));
const { rendererFile } = await import("../src/main/app-protocol");

const root = "/Applications/Tandrix.app/Contents/Resources/app/dist/renderer";

describe("rendererFile", () => {
  it("serves files inside the renderer folder", () => {
    expect(rendererFile("/panel.html", root)).toBe(`${root}/panel.html`);
    expect(rendererFile("/assets/panel-abc.js", root)).toBe(`${root}/assets/panel-abc.js`);
  });

  it("refuses paths that climb out, plainly or encoded", () => {
    expect(rendererFile("/../main/index.cjs", root)).toBeNull();
    expect(rendererFile("/%2e%2e/%2e%2e/secrets", root)).toBeNull();
    expect(rendererFile("/assets/..%2f..%2fmain/index.cjs", root)).toBeNull();
  });

  it("refuses the folder itself", () => {
    expect(rendererFile("/", root)).toBeNull();
  });
});
