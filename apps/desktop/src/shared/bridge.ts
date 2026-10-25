// The only surface the renderer has into the main process (exposed by the preload as
// window.tandrix). Channel names and payloads live here so both sides agree.
import type { ScreenGeometry } from "@tandrix/contracts";

export const channels = {
  storageGet: "storage:get",
  storageSet: "storage:set",
  storageRemove: "storage:remove",
  screenAccess: "screen:access",
  screenSettings: "screen:settings",
  screenCapture: "screen:capture",
  panelShow: "panel:show",
  deviceName: "device:name",
  notify: "panel:notify",
  testPointer: "overlay:test-pointer",
  pointAt: "overlay:point-at",
  clearPointer: "overlay:clear",
  pointer: "overlay:pointer",
  micAccess: "voice:mic-access",
  listening: "voice:listening",
  askHotkey: "voice:ask-hotkey",
  askCancel: "voice:ask-cancel",
} as const;

/** The Show me hotkey, as macOS writes it. */
export const ASK_KEYS = "⌃⌥Space";

/** macOS Screen Recording state for this app, as `systemPreferences` reports it. */
export type ScreenAccess = "granted" | "denied" | "not-determined" | "restricted" | "unknown";

/** Where an overlay draws the pointer, in that overlay window's own coordinates. */
export interface OverlayPointer {
  x: number;
  y: number;
  caption?: string;
}

/** A screenshot of the display under the cursor, downsized, with how to map it back. */
export interface ScreenCapture {
  image: Uint8Array;
  mimeType: "image/jpeg";
  geometry: ScreenGeometry;
  capturedAt: string;
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
    /**
     * The screen the user is asking about: the one captured when they pressed the hotkey, or a
     * fresh capture (with the panel put away first).
     */
    capture(): Promise<ScreenCapture>;
  };
  device: {
    /** This Mac's name as people know it ("Ahmad's MacBook Pro"), shown when pairing. */
    name(): Promise<string>;
  };
  panel: {
    /** Brings the panel back, e.g. after it was put away for a screenshot. */
    show(): Promise<void>;
    /** A macOS notification; clicking it opens the panel. */
    notify(title: string, body: string): Promise<void>;
  };
  overlay: {
    /** Shows the pointer at the centre of every display for a few seconds. */
    testPointer(): Promise<void>;
    /** Points at a pixel of a capture, on the display it came from. */
    pointAt(
      geometry: ScreenGeometry,
      point: { x: number; y: number },
      caption: string,
    ): Promise<void>;
    clear(): Promise<void>;
    /** Overlay windows only: called with the pointer to draw, or null to clear it. */
    onPointer(listener: (pointer: OverlayPointer | null) => void): () => void;
  };
  voice: {
    /** Asks macOS for the microphone the first time; true when Tandrix may use it. */
    micAccess(): Promise<boolean>;
    /** Tells the main process to take Esc (cancel) while listening. */
    setListening(listening: boolean): Promise<void>;
    /** The Show me hotkey was pressed: start listening, or send what was heard. */
    onHotkey(listener: () => void): () => void;
    /** Esc while listening. */
    onCancel(listener: () => void): () => void;
  };
}
