// The only surface the renderer has into the main process (exposed by the preload as
// window.tandrix). Channel names and payloads live here so both sides agree.

export const channels = {
  storageGet: "storage:get",
  storageSet: "storage:set",
  storageRemove: "storage:remove",
  screenAccess: "screen:access",
  screenSettings: "screen:settings",
  testPointer: "overlay:test-pointer",
  pointer: "overlay:pointer",
} as const;

/** macOS Screen Recording state for this app, as `systemPreferences` reports it. */
export type ScreenAccess = "granted" | "denied" | "not-determined" | "restricted" | "unknown";

/** Where an overlay draws the pointer, in that overlay window's own coordinates. */
export interface OverlayPointer {
  x: number;
  y: number;
  caption?: string;
}

export interface TandrixBridge {
  /** Encrypted on disk by the main process (macOS Keychain-backed `safeStorage`). */
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  screen: {
    access(): Promise<ScreenAccess>;
    openSettings(): Promise<void>;
  };
  overlay: {
    /** Shows the pointer at the centre of every display for a few seconds. */
    testPointer(): Promise<void>;
    /** Overlay windows only: called with the pointer to draw, or null to clear it. */
    onPointer(listener: (pointer: OverlayPointer | null) => void): () => void;
  };
}
