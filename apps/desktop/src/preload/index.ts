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
  voice: {
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
