// The only surface the renderer has into the main process (exposed by the preload as
// window.tandrix). Channel names and payloads live here so both sides agree.
import type { ControlMode, DesktopAction, SafetyCheck, ScreenGeometry } from "@tandrix/contracts";

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
  micStatus: "voice:mic-status",
  listening: "voice:listening",
  askHotkey: "voice:ask-hotkey",
  askCancel: "voice:ask-cancel",
  speak: "voice:speak",
  stopSpeaking: "voice:stop-speaking",
  talkStart: "voice:talk-start",
  talkEnd: "voice:talk-end",
  talkKeysAccess: "voice:talk-keys-access",
  setPresence: "presence:set",
  controlMode: "do:mode",
  setControlMode: "do:set-mode",
  doBegin: "do:begin",
  doRun: "do:run",
  doEnd: "do:end",
  doStop: "do:stop",
  doApps: "do:apps",
  doOpenApp: "do:open-app",
  presence: "overlay:presence",
} as const;

/** Hold these to talk; let go to ask. */
export const TALK_KEYS = "⌥⌘";

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

/** What Tandrix is doing, for the presence bar at the top of the screen. Null: idle, nothing shown. */
export interface Presence {
  state: "listening" | "thinking" | "looking" | "answering" | "doing";
  label: string;
  keys?: string;
  keysHint?: string;
  text?: string;
  /** Microphone level, 0 to 1. */
  level?: number;
}

/** A presence as an overlay draws it: with the room the menu bar (and notch) takes at the top. */
export type OverlayPresence = Presence & { top: number };

/** A screenshot of the display under the cursor, downsized, with how to map it back. */
export interface ScreenCapture {
  image: Uint8Array;
  mimeType: "image/jpeg";
  geometry: ScreenGeometry;
  capturedAt: string;
}

/** One batch of model-proposed actions for the main process to check and run. */
export interface DoBatch {
  actions: DesktopAction[];
  geometry: ScreenGeometry;
  intent: string;
  safetyChecks: SafetyCheck[];
}

export type DoBatchResult =
  | { status: "ran"; ran: number; acknowledged: SafetyCheck[] }
  | { status: "stopped" | "refused"; ran: number; message: string };

export interface TandrixBridge {
  /** Do it for me: the mode lives in the main process, which alone runs actions. */
  doing: {
    mode(): Promise<ControlMode>;
    /** Returns the mode in force: "do" needs Accessibility, so it may stay "show". */
    setMode(mode: ControlMode): Promise<ControlMode>;
    begin(): Promise<void>;
    run(batch: DoBatch): Promise<DoBatchResult>;
    end(): Promise<void>;
    stop(): Promise<void>;
    /** Installed apps, and the one in front (not Tandrix), for the task's plan. */
    apps(): Promise<{ apps: string[]; front?: string }>;
    /** Opens an installed app during a task; false if it isn't installed or no task runs. */
    openApp(name: string): Promise<boolean>;
  };
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
    /** Shows what Tandrix is doing at the top of the screen; null hides it. */
    setPresence(presence: Presence | null): Promise<void>;
    /** Overlay windows only: the presence to draw, or null. */
    onPresence(listener: (presence: OverlayPresence | null) => void): () => void;
  };
  voice: {
    /** Asks macOS for the microphone the first time; true when Tandrix may use it. */
    micAccess(): Promise<boolean>;
    /** The microphone permission as it stands, without asking. */
    micStatus(): Promise<ScreenAccess>;
    /** Tells the main process to take Esc (cancel) while listening. */
    setListening(listening: boolean): Promise<void>;
    /** The Show me hotkey was pressed: start listening, or send what was heard. */
    onHotkey(listener: () => void): () => void;
    /** Esc while listening. */
    onCancel(listener: () => void): () => void;
    /** Speaks a reply in the best macOS voice installed; false if it can't. */
    speak(text: string): Promise<boolean>;
    stopSpeaking(): Promise<void>;
    /** ⌥⌘ held: start listening (the screen is captured as it is now). */
    onTalkStart(listener: () => void): () => void;
    /** ⌥⌘ let go: ask. */
    onTalkEnd(listener: () => void): () => void;
    /** Whether macOS lets Tandrix notice ⌥⌘ in other apps (Accessibility); asks when `ask`. */
    talkKeysAccess(ask: boolean): Promise<boolean>;
  };
}
