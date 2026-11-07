import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..");
const distNative = join(root, "dist", "native");

if (!existsSync(distNative)) {
  mkdirSync(distNative, { recursive: true });
}

if (process.platform !== "darwin") {
  console.log(
    `[build:native] Platform is ${process.platform}; skipping macOS Swift binary compilation.`,
  );
  process.exit(0);
}

try {
  execSync("which swiftc", { stdio: "ignore" });
} catch {
  console.warn(
    "[build:native] swiftc not found on this system; skipping Swift binary compilation.",
  );
  process.exit(0);
}

console.log("[build:native] Compiling macOS native Swift binaries...");
try {
  execSync("swiftc -O -o dist/native/tandrix-input native/input/main.swift", {
    cwd: root,
    stdio: "inherit",
  });
  execSync(
    "swiftc -O -o dist/native/tandrix-wake native/wake/main.swift native/wake/voiceprint.swift native/wake/hear.swift native/wake/continuous.swift native/wake/mic.swift native/wake/spike.swift -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker native/wake/Info.plist",
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  console.log("[build:native] Swift compilation completed successfully.");
} catch (err) {
  console.error("[build:native] Error compiling Swift native binaries:", err);
  process.exit(1);
}
