// First-run setup progress kept on this Mac (a convenience, not something to sync).
import { useEffect, useState } from "react";

const TRIED = "tandrix.setup.tried";
const SKIPPED = "tandrix.setup.skipped";
const CHANGED = "tandrix-setup-changed";

const read = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const write = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Without storage, setup shows again next time; nothing breaks.
  }
  window.dispatchEvent(new Event(CHANGED));
};

/** Called after the first answered question, however it was asked. */
export const markTried = () => !read(TRIED) && write(TRIED);
export const skipSetup = () => write(SKIPPED);

export function useSetupFlags() {
  const [flags, setFlags] = useState(() => ({ tried: read(TRIED), skipped: read(SKIPPED) }));
  useEffect(() => {
    const update = () => setFlags({ tried: read(TRIED), skipped: read(SKIPPED) });
    window.addEventListener(CHANGED, update);
    return () => window.removeEventListener(CHANGED, update);
  }, []);
  return flags;
}
