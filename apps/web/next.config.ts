import type { NextConfig } from "next";

const config: NextConfig = {
  // The design system and contracts ship as TypeScript source from the workspace.
  transpilePackages: ["@tandrix/ui", "@tandrix/contracts"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Next writes an AGENTS.md into the app by default; the repo keeps its own guidance.
  agentRules: false,
};

export default config;
