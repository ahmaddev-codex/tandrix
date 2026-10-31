import type { NextConfig } from "next";

const security = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing on the site uses these, and it's never framed.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const config: NextConfig = {
  // The design system and contracts ship as TypeScript source from the workspace.
  transpilePackages: ["@tandrix/ui", "@tandrix/contracts"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Next writes an AGENTS.md into the app by default; the repo keeps its own guidance.
  agentRules: false,
  async headers() {
    return [
      { source: "/:path*", headers: security },
      // A shared report's address is its key: never send it to another site.
      { source: "/r/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default config;
