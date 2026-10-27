import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const repoRoot = resolve(import.meta.dirname, "../..");
const renderer = resolve(import.meta.dirname, "src/renderer");

/**
 * Network access for the renderer: the Tandrix API and Supabase (HTTP and realtime) only. Images
 * also load from Supabase: step pictures come as signed Storage URLs.
 */
function contentSecurityPolicy(env: Record<string, string>, dev: boolean): Plugin {
  const origins = [env.VITE_API_URL, env.VITE_SUPABASE_URL]
    .filter((u): u is string => !!u)
    .map((u) => new URL(u).origin);
  const storage = env.VITE_SUPABASE_URL ? ` ${new URL(env.VITE_SUPABASE_URL).origin}` : "";
  const sockets = origins.map((o) => o.replace(/^http/, "ws"));
  const policy = [
    "default-src 'none'",
    // Vite's dev server injects an inline React refresh preamble and inline styles.
    `script-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
    "font-src 'self'",
    `img-src 'self' data: blob:${storage}`,
    `connect-src ${[...origins, ...sockets, ...(dev ? ["ws://localhost:5173"] : [])].join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return {
    name: "tandrix-csp",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: policy },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ command, mode }) => {
  const dev = command === "serve";
  return {
    root: renderer,
    base: "./",
    envDir: repoRoot,
    envPrefix: ["VITE_", "TANDRIX_ENV"],
    plugins: [react(), contentSecurityPolicy(loadEnv(mode, repoRoot, "VITE_"), dev)],
    server: { port: 5173, strictPort: true, fs: { allow: [repoRoot] } },
    build: {
      outDir: resolve(import.meta.dirname, "dist/renderer"),
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          panel: resolve(renderer, "panel.html"),
          overlay: resolve(renderer, "overlay.html"),
        },
      },
    },
  };
});
