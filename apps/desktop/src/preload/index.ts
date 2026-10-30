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
    apps: () => ipcRenderer.invoke(channels.doApps),
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
  },
  device: {
    name: () => ipcRenderer.invoke(channels.deviceName),
  },
  panel: {
    show: () => ipcRenderer.invoke(channels.panelShow),
    notify: (title, body) => ipcRenderer.invoke(channels.notify, title, body),
  },
  overlay: {
    testPointer: () => ipcRenderer.invoke(channels.testPointer),
    pointAt: (geometry, point, caption) =>
      ipcRenderer.invoke(channels.pointAt, geometry, point, caption),
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
    voiceprint: () => ipcRenderer.invoke(channels.voiceprint),
    voicePhrase: (index, action) => ipcRenderer.invoke(channels.voicePhrase, index, action),
    voiceFinish: () => ipcRenderer.invoke(channels.voiceFinish),
    setOnlyMyVoice: (on) => ipcRenderer.invoke(channels.voiceOnlyMine, on),
    deleteVoice: () => ipcRenderer.invoke(channels.voiceDelete),
    onTalkStart: (listener) => subscribe(channels.talkStart, listener),
    onTalkEnd: (listener) => subscribe(channels.talkEnd, listener),
    talkKeysAccess: (ask) => ipcRenderer.invoke(channels.talkKeysAccess, ask),
    micAccess: () => ipcRenderer.invoke(channels.micAccess),
    micStatus: () => ipcRenderer.invoke(channels.micStatus),
    setListening: (listening) => ipcRenderer.invoke(channels.listening, listening),
    onHotkey: (listener) => subscribe(channels.askHotkey, listener),
    onCancel: (listener) => subscribe(channels.askCancel, listener),
    speak: (text) => ipcRenderer.invoke(channels.speak, text),
    stopSpeaking: () => ipcRenderer.invoke(channels.stopSpeaking),
  },
};

contextBridge.exposeInMainWorld("tandrix", bridge);
