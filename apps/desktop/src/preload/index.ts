import { contextBridge, ipcRenderer } from "electron";
import {
  channels,
  type OverlayPointer,
  type OverlayPresence,
  type TandrixBridge,
} from "../shared/bridge";

const subscribe = (channel: string, listener: () => void) => {
  const fn = () => listener();
  ipcRenderer.on(channel, fn);
  return () => {
    ipcRenderer.off(channel, fn);
  };
};

const bridge: TandrixBridge = {
  doing: {
    mode: () => ipcRenderer.invoke(channels.controlMode),
    setMode: (mode) => ipcRenderer.invoke(channels.setControlMode, mode),
    begin: () => ipcRenderer.invoke(channels.doBegin),
    run: (batch) => ipcRenderer.invoke(channels.doRun, batch),
    end: () => ipcRenderer.invoke(channels.doEnd),
    stop: () => ipcRenderer.invoke(channels.doStop),
    onStopped: (listener) => subscribe(channels.doStopped, listener),
    apps: () => ipcRenderer.invoke(channels.doApps),
    front: () => ipcRenderer.invoke(channels.doFront),
    controls: () => ipcRenderer.invoke(channels.doControls),
    openApp: (name) => ipcRenderer.invoke(channels.doOpenApp, name),
  },
  storage: {
    getItem: (key) => ipcRenderer.invoke(channels.storageGet, key),
    setItem: (key, value) => ipcRenderer.invoke(channels.storageSet, key, value),
    removeItem: (key) => ipcRenderer.invoke(channels.storageRemove, key),
  },
  screen: {
    access: () => ipcRenderer.invoke(channels.screenAccess),
    openSettings: () => ipcRenderer.invoke(channels.screenSettings),
    capture: () => ipcRenderer.invoke(channels.screenCapture),
    text: (image, mimeType) => ipcRenderer.invoke(channels.screenText, image, mimeType),
  },
  device: {
    name: () => ipcRenderer.invoke(channels.deviceName),
  },
  panel: {
    show: () => ipcRenderer.invoke(channels.panelShow),
    notify: (title, body) => ipcRenderer.invoke(channels.notify, title, body),
  },
  diagnostics: {
    timing: (t) => ipcRenderer.invoke(channels.replyTiming, t),
  },
  overlay: {
    testPointer: () => ipcRenderer.invoke(channels.testPointer),
    pointAt: (geometry, point, caption, annotation) =>
      ipcRenderer.invoke(channels.pointAt, geometry, point, caption, annotation ?? {}),
    clear: () => ipcRenderer.invoke(channels.clearPointer),
    setPresence: (presence) => ipcRenderer.invoke(channels.setPresence, presence),
    onPresence: (listener) => {
      const fn = (_e: unknown, p: OverlayPresence | null) => listener(p);
      ipcRenderer.on(channels.presence, fn);
      return () => {
        ipcRenderer.off(channels.presence, fn);
      };
    },
    onPointer: (listener) => {
      const fn = (_e: unknown, pointer: OverlayPointer | null) => listener(pointer);
      ipcRenderer.on(channels.pointer, fn);
      return () => {
        ipcRenderer.off(channels.pointer, fn);
      };
    },
  },
  agent: {
    runTool: (call) => ipcRenderer.invoke(channels.agentTool, call),
  },
  browser: {
    open: (url) => ipcRenderer.invoke(channels.browserOpen, url),
    capture: (id) => ipcRenderer.invoke(channels.browserCapture, id),
    run: (id, batch) => ipcRenderer.invoke(channels.browserRun, id, batch),
    close: (id) => ipcRenderer.invoke(channels.browserClose, id),
    signIn: (url) => ipcRenderer.invoke(channels.browserSignIn, url),
  },
  voice: {
    setWakeWord: (on) => ipcRenderer.invoke(channels.wakeSet, on),
    onWakeStatus: (listener) => {
      const fn = (_e: unknown, s: Parameters<typeof listener>[0]) => listener(s);
      ipcRenderer.on(channels.wakeStatus, fn);
      return () => {
        ipcRenderer.off(channels.wakeStatus, fn);
      };
    },
    onWake: (listener) => {
      const fn = (_e: unknown, rest: string) => listener(rest);
      ipcRenderer.on(channels.wake, fn);
      return () => {
        ipcRenderer.off(channels.wake, fn);
      };
    },
    onWakeIgnored: (listener) => subscribe(channels.wakeIgnored, listener),
    onWakeHeard: (listener) => subscribe(channels.wakeHeard, listener),
    setWakeName: (name) => ipcRenderer.invoke(channels.wakeName, name),
    voiceprint: () => ipcRenderer.invoke(channels.voiceprint),
    voicePhrase: (index, action) => ipcRenderer.invoke(channels.voicePhrase, index, action),
    voiceFinish: () => ipcRenderer.invoke(channels.voiceFinish),
    setOnlyMyVoice: (on) => ipcRenderer.invoke(channels.voiceOnlyMine, on),
    deleteVoice: () => ipcRenderer.invoke(channels.voiceDelete),
    onTalkStart: (listener) => subscribe(channels.talkStart, listener),
    onTalkEnd: (listener) => subscribe(channels.talkEnd, listener),
    talkKeysAccess: (ask) => ipcRenderer.invoke(channels.talkKeysAccess, ask),
    micAccess: () => ipcRenderer.invoke(channels.micAccess),
    hear: {
      begin: (words) => ipcRenderer.invoke(channels.hearBegin, words ?? []),
      audio: (id, pcm) => ipcRenderer.send(channels.hearAudio, id, pcm),
      end: (id) => ipcRenderer.invoke(channels.hearEnd, id),
      cancel: (id) => ipcRenderer.invoke(channels.hearCancel, id),
    },
    micStatus: () => ipcRenderer.invoke(channels.micStatus),
    setListening: (listening) => ipcRenderer.invoke(channels.listening, listening),
    onHotkey: (listener) => subscribe(channels.askHotkey, listener),
    onCancel: (listener) => subscribe(channels.askCancel, listener),
    setAnswering: (on) => ipcRenderer.invoke(channels.answering, on),
    onAnswerStop: (listener) => subscribe(channels.answerStop, listener),
    speak: (text, volume = 1) => ipcRenderer.invoke(channels.speak, text, volume),
    stopSpeaking: () => ipcRenderer.invoke(channels.stopSpeaking),
  },
};

contextBridge.exposeInMainWorld("tandrix", bridge);
