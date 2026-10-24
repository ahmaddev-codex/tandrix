import * as SecureStore from "expo-secure-store";

// Supabase sessions can exceed what one SecureStore entry should hold, so values are split
// into chunks. Everything stays in the device keychain/keystore; nothing goes to plain storage.
const CHUNK = 1800;
const countKey = (k: string) => `${k}.n`;
const chunkKey = (k: string, i: number) => `${k}.${i}`;
// SecureStore keys allow only [A-Za-z0-9._-].
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

async function removeItem(key: string) {
  const k = safe(key);
  const n = Number((await SecureStore.getItemAsync(countKey(k))) ?? 0);
  await Promise.all(
    Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(chunkKey(k, i))),
  );
  await SecureStore.deleteItemAsync(countKey(k));
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const n = Number((await SecureStore.getItemAsync(countKey(k))) ?? 0);
    if (!n) return null;
    const parts = await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(chunkKey(k, i))),
    );
    // A missing chunk means a partial write; treat as signed out rather than a corrupt session.
    return parts.every((p) => p !== null) ? parts.join("") : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeItem(key);
    const k = safe(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, "g")) ?? [""];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(k, i), c)));
    await SecureStore.setItemAsync(countKey(k), String(chunks.length));
  },
  removeItem,
};
