// The text on a screenshot and exactly where it is (native/text: Apple's Vision, on this Mac), so
// a mark lands on the very words, line of code or formula Tandrix is explaining.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";

export interface ReadLine {
  text: string;
  box: [number, number, number, number];
  chars: Array<[number, number]>;
}

function helper(): string {
  const packaged = join(process.resourcesPath ?? "", "native", "tandrix-text");
  return existsSync(packaged) ? packaged : join(app.getAppPath(), "dist", "native", "tandrix-text");
}

/** The lines read off an image, in its pixels; none when it can't be read. Nothing leaves the Mac. */
export async function readScreenText(image: unknown, mimeType: unknown): Promise<ReadLine[]> {
  if (!(image instanceof Uint8Array) || image.byteLength > 16 * 1024 * 1024) return [];
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const dir = await mkdtemp(join(tmpdir(), "tandrix-text-"));
  const file = join(dir, `screen.${ext}`);
  try {
    await writeFile(file, image);
    const out = await new Promise<string>((resolve, reject) =>
      execFile(helper(), [file], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (e, stdout) =>
        e ? reject(e) : resolve(stdout),
      ),
    );
    const parsed = JSON.parse(out) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    return parsed.lines.filter(
      (l): l is ReadLine =>
        !!l &&
        typeof (l as ReadLine).text === "string" &&
        Array.isArray((l as ReadLine).box) &&
        Array.isArray((l as ReadLine).chars),
    );
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
