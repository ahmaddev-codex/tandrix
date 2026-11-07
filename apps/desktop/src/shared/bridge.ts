// The only surface the renderer has into the main process (exposed by the preload as
// window.tandrix). Channel names and payloads live here so both sides agree.
import type {
  AgentCall,
  ControlMode,
  DesktopAction,
  SafetyCheck,
  ScreenGeometry,
} from "@tandrix/contracts";
import type { ReplyTiming, TaskTiming } from "@tandrix/core";

export const channels = {
  storageGet: "storage:get",
  storageSet: "storage:set",
  storageRemove: "storage:remove",
  screenAccess: "screen:access",
  screenSettings: "screen:settings",
  screenCapture: "screen:capture",
  screenText: "screen:text",
  screenSketch: "screen:sketch",
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
  answering: "voice:answering",
  answerStop: "voice:answer-stop",
  speak: "voice:speak",
  stopSpeaking: "voice:stop-speaking",
  talkStart: "voice:talk-start",
  talkEnd: "voice:talk-end",
  talkKeysAccess: "voice:talk-keys-access",
  wakeSet: "voice:wake-set",
  hearBegin: "voice:hear-begin",
  hearAudio: "voice:hear-audio",
  hearEnd: "voice:hear-end",
  hearCancel: "voice:hear-cancel",
  wakeStatus: "voice:wake-status",
  wake: "voice:wake",
  wakeIgnored: "voice:wake-ignored",
  wakeHeard: "voice:wake-heard",
  wakeName: "voice:wake-name",
  voiceprint: "voice:print",
  voicePhrase: "voice:print-phrase",
  voiceFinish: "voice:print-finish",
  voiceOnlyMine: "voice:print-only-mine",
  voiceDelete: "voice:print-delete",
  agentTool: "agent:tool",
  browserOpen: "browser:open",
  browserCapture: "browser:capture",
  browserRun: "browser:run",
  browserClose: "browser:close",
  browserSignIn: "browser:sign-in",
  setPresence: "presence:set",
  replyTiming: "diagnostics:reply-timing",
  controlMode: "do:mode",
  setControlMode: "do:set-mode",
  doBegin: "do:begin",
  doRun: "do:run",
  doEnd: "do:end",
  doStop: "do:stop",
  doStopped: "do:stopped",
  doApps: "do:apps",
  doFront: "do:front",
  doControls: "do:controls",
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
  /** Doing the work (Do it for me): the pointer glides between steps and shows each action. */
  working?: { act: "click" | "type" | "keys" | "move" | "scroll" | "drag"; seq: number };
  box?: { width: number; height: number };
  step?: number;
  /** An annotation's name tag ("Equation") and written note, beside its frame. */
  label?: string;
  note?: string;
  /** How long it stays before it fades, in milliseconds. */
  hold?: number;
  /** Each part marked up, drawn one after another. */
  regions?: AnnotatedRegion[];
}

/**
 * A part marked up: its frame in display points, centred `dx`, `dy` from the pointer, its name
 * and what it is or does.
 */
export interface AnnotatedRegion {
  dx: number;
  dy: number;
  width: number;
  height: number;
  label: string;
  detail?: string;
  /** Where the pen touches the part, from its centre, in display points. */
  ax?: number;
  ay?: number;
  /**
   * How it's marked, and the strokes the pen draws, each a flat run of x, y in display points
   * from the part's centre (empty for a dot).
   */
  mark?: { kind: string; strokes: number[][] };
}

/** What a pointer can carry besides where it points (Show me's annotations). */
export interface PointAnnotation {
  /** A frame drawn round what it's about, in display points, centred on the point. */
  box?: { width: number; height: number };
  label?: string;
  note?: string;
  hold?: number;
  step?: number;
  regions?: AnnotatedRegion[];
}

/** What Tandrix is doing, for the presence bar at the top of the screen. Null: idle, nothing shown. */
/** A control in the front window (SP5), from its accessibility tree: names and frames only. */
export interface ScreenControl {
  role: string;
  name: string;
  enabled: boolean;
  /** Global display points, origin at the top left of the main display. */
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** The screen at 48×30, one brightness (0–255) per cell: tells a real change from a caret blink. */
  sketch?: number[];
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
    /** The user stopped the task (Esc or the hotkey). */
    onStopped(listener: () => void): () => void;
    /** Installed apps, and the one in front (not Tandrix), for the task's plan. */
    apps(): Promise<{ apps: string[]; front?: string }>;
    /** The app in front now (not Tandrix), to tell when a task moves between apps. */
    front(): Promise<string | undefined>;
    /** The front window's controls (not Tandrix's), names and frames only. */
    controls(): Promise<ScreenControl[]>;
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
    /** A display's sketch now (48×30 brightness), to tell whether the page moved. */
    sketch(displayId: string): Promise<number[] | null>;
    /** The text on a capture and where each line (and character) is, read on this Mac. */
    text(
      image: Uint8Array,
      mimeType: string,
    ): Promise<
      Array<{ text: string; box: [number, number, number, number]; chars: Array<[number, number]> }>
    >;
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
  diagnostics: {
    /** How long a reply's stages, or a task's turns, took: numbers only, written to the log. */
    timing(t: ReplyTiming | TaskTiming): Promise<void>;
  };
  overlay: {
    /** Shows the pointer at the centre of every display for a few seconds. */
    testPointer(): Promise<void>;
    /** Points at a pixel of a capture, on the display it came from. */
    pointAt(
      geometry: ScreenGeometry,
      point: { x: number; y: number },
      caption: string,
      annotation?: PointAnnotation,
    ): Promise<void>;
    clear(): Promise<void>;
    /** Overlay windows only: called with the pointer to draw, or null to clear it. */
    onPointer(listener: (pointer: OverlayPointer | null) => void): () => void;
    /** Shows what Tandrix is doing at the top of the screen; null hides it. */
    setPresence(presence: Presence | null): Promise<void>;
    /** Overlay windows only: the presence to draw, or null. */
    onPresence(listener: (presence: OverlayPresence | null) => void): () => void;
  };
  /** Background agents' tools: run on this Mac without its screen, mouse or keyboard. */
  agent: {
    runTool(call: AgentCall): Promise<string>;
  };
  /**
   * Tandrix's own browser: hidden tabs a background agent drives without the user's screen,
   * mouse or keyboard, on a profile where the user signs in to sites once.
   */
  browser: {
    open(url: string): Promise<number>;
    capture(id: number): Promise<ScreenCapture & { url: string }>;
    run(id: number, batch: DoBatch): Promise<DoBatchResult>;
    close(id: number): Promise<void>;
    /** A visible window on that profile, to sign in to a site. */
    signIn(url: string): Promise<void>;
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
    /** Tandrix is answering (working it out, speaking, touring): Esc stops it while it is. */
    setAnswering(on: boolean): Promise<void>;
    /** Esc while answering. */
    onAnswerStop(listener: () => void): () => void;
    /** Speaks a reply in the best macOS voice installed, at a volume 0.1–1; false if it can't. */
    speak(text: string, volume?: number): Promise<boolean>;
    stopSpeaking(): Promise<void>;
    /**
     * The question being asked, heard on this Mac as it's said (no upload): `begin` when listening
     * starts (0 when this Mac can't hear it), `audio` for each piece of 16 kHz 16-bit PCM, `end`
     * for its text when the user lets go (null: upload the recording instead).
     */
    hear: {
      /** `words`: the user's own words to hear right (VO5). */
      begin(words?: string[]): Promise<number>;
      audio(id: number, pcm: Uint8Array): void;
      end(id: number): Promise<{ text: string; ms: number; engine: string } | null>;
      cancel(id: number): Promise<void>;
    };
    /** Switches the on-device wake word ("Hey Tandrix") on or off. */
    setWakeWord(on: boolean): Promise<void>;
    /** The wake word's state, and why it can't listen when it can't. */
    onWakeStatus(
      listener: (s: {
        status: "off" | "starting" | "listening" | "unavailable";
        message?: string;
      }) => void,
    ): () => void;
    /** "Hey Tandrix" was heard; `rest` is anything said after it in the same breath. */
    onWake(listener: (rest: string) => void): () => void;
    /** The name the wake word listens for (one word; Tandrix unless the user chose another). */
    setWakeName(name: string): Promise<void>;
    /** The name was just heard, before the user has finished: chime and show it's listening. */
    onWakeHeard(listener: () => void): () => void;
    /** "Hey Tandrix" was heard in a voice that isn't the user's, and only-my-voice is on. */
    onWakeIgnored(listener: () => void): () => void;
    /** Whether this Mac knows the user's voice, and whether it answers only that voice. */
    voiceprint(): Promise<{ enrolled: boolean; onlyMine: boolean }>;
    /**
     * Records setup phrase `index` (0–2): `start`, then `stop` when they've said it. Needs the wake
     * word listening. `ok` false with a reason when there wasn't enough voice.
     */
    voicePhrase(
      index: number,
      action: "start" | "stop",
    ): Promise<{ ok: true } | { ok: false; reason: string }>;
    /** Saves the voiceprint from the three phrases, or names the one to say again. */
    voiceFinish(): Promise<{ ok: true } | { ok: false; redo: number }>;
    setOnlyMyVoice(on: boolean): Promise<void>;
    /** Deletes the voiceprint from this Mac. */
    deleteVoice(): Promise<void>;
    /** ⌥⌘ held: start listening (the screen is captured as it is now). */
    onTalkStart(listener: () => void): () => void;
    /** ⌥⌘ let go: ask. */
    onTalkEnd(listener: () => void): () => void;
    /** Whether macOS lets Tandrix notice ⌥⌘ in other apps (Accessibility); asks when `ask`. */
    talkKeysAccess(ask: boolean): Promise<boolean>;
  };
}
