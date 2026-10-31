import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({}),
  // `pnpm run build` is this build, as Cloudflare's build step runs it, so Next's has its own script.
  buildCommand: "pnpm run build:next",
};
