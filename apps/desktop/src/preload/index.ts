import { contextBridge, ipcRenderer } from "electron";
import { channels, type OverlayPointer, type TandrixBridge } from "../shared/bridge";

const bridge: TandrixBridge = {
  storage: {
    getItem: (key) => ipcRenderer.invoke(channels.storageGet, key),
    setItem: (key, value) => ipcRenderer.invoke(channels.storageSet, key, value),
    removeItem: (key) => ipcRenderer.invoke(channels.storageRemove, key),
  },
  screen: {
    access: () => ipcRenderer.invoke(channels.screenAccess),
    openSettings: () => ipcRenderer.invoke(channels.screenSettings),
  },
  overlay: {
    testPointer: () => ipcRenderer.invoke(channels.testPointer),
    onPointer: (listener) => {
      const fn = (_e: unknown, pointer: OverlayPointer | null) => listener(pointer);
      ipcRenderer.on(channels.pointer, fn);
      return () => ipcRenderer.off(channels.pointer, fn);
    },
  },
};

contextBridge.exposeInMainWorld("tandrix", bridge);
