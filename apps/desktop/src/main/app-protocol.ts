// Packaged builds serve the renderer from app://tandrix instead of file://, so pages have a
// real origin: the API can allow it by name (CORS), and the CSP's 'self' means only the app.
import { join, normalize, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";

export const APP_ORIGIN = "app://tandrix";
const rendererDir = join(__dirname, "../renderer");

/** Must run before the app is ready. */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** A request path inside the renderer folder, or null for anything that escapes it. */
export function rendererFile(pathname: string, root = rendererDir): string | null {
  const file = normalize(join(root, decodeURIComponent(pathname)));
  const rel = relative(root, file);
  return rel && !rel.startsWith("..") && !rel.startsWith("/") ? file : null;
}

export function serveAppScheme() {
  protocol.handle("app", (req) => {
    const url = new URL(req.url);
    const file = url.host === "tandrix" ? rendererFile(url.pathname) : null;
    if (!file) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}
