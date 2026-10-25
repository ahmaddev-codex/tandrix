// Sign-in session storage for the renderer's Supabase client. Values are encrypted with
// safeStorage (a key held in the macOS Keychain) and written under the app's userData folder;
// file names are hashes so storage keys never appear on disk. Without safeStorage, sessions
// stay in memory and the user signs in again next launch.
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";

const memory = new Map<string, string>();
const dir = () => join(app.getPath("userData"), "session");
const fileFor = (key: string) =>
  join(dir(), `${createHash("sha256").update(key).digest("hex")}.bin`);

export const sessionStore = {
  async getItem(key: string): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) return memory.get(key) ?? null;
    try {
      return safeStorage.decryptString(await readFile(fileFor(key)));
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      memory.set(key, value);
      return;
    }
    await mkdir(dir(), { recursive: true, mode: 0o700 });
    await writeFile(fileFor(key), safeStorage.encryptString(value), { mode: 0o600 });
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    await rm(fileFor(key), { force: true });
  },
};
