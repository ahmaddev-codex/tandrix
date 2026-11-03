import { beforeEach, describe, expect, it, vi } from "vitest";

const shortcut = vi.hoisted(() => {
  const held = new Map<string, () => void>();
  return {
    held,
    register: vi.fn((key: string, fn: () => void) => {
      if (held.has(key)) return false;
      held.set(key, fn);
      return true;
    }),
    unregister: vi.fn((key: string) => void held.delete(key)),
    isRegistered: vi.fn((key: string) => held.has(key)),
  };
});
vi.mock("electron", () => ({ globalShortcut: shortcut }));

import { setCancelKey, withEscFree } from "../src/main/hotkey";

const pressEsc = () => shortcut.held.get("Escape")?.();

describe("Esc", () => {
  beforeEach(() => {
    setCancelKey("task", null);
    setCancelKey("listening", null);
  });

  it("is only taken while something needs it", () => {
    expect(shortcut.held.has("Escape")).toBe(false);
    setCancelKey("task", () => undefined);
    expect(shortcut.held.has("Escape")).toBe(true);
    setCancelKey("task", null);
    expect(shortcut.held.has("Escape")).toBe(false);
  });

  it("still stops a task after the user talks during it", () => {
    const stop = vi.fn();
    setCancelKey("task", stop);
    setCancelKey("listening", () => undefined);
    setCancelKey("listening", null);
    pressEsc();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("stops a task that began while Tandrix was listening", () => {
    const stop = vi.fn();
    setCancelKey("listening", () => undefined);
    setCancelKey("task", stop);
    setCancelKey("listening", null);
    pressEsc();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("cancels listening and stops the task together", () => {
    const cancel = vi.fn();
    const stop = vi.fn();
    setCancelKey("task", stop);
    setCancelKey("listening", cancel);
    pressEsc();
    expect(cancel).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("lets Tandrix's own Esc through without stopping its task", async () => {
    const stop = vi.fn();
    setCancelKey("task", stop);
    await withEscFree(async () => {
      expect(shortcut.held.has("Escape")).toBe(false);
    });
    pressEsc();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("takes Esc back even if pressing it fails", async () => {
    setCancelKey("task", () => undefined);
    await expect(
      withEscFree(async () => {
        throw new Error("driver gone");
      }),
    ).rejects.toThrow("driver gone");
    expect(shortcut.held.has("Escape")).toBe(true);
  });
});
