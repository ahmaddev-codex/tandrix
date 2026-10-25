import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
import "./globals.css";
import { colors } from "@tandrix/ui";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tandrix — an AI engineer for the work in front of you",
  description:
    "On your phone, Tandrix guides physical work step by step and checks it with a photo. On your Mac, it points at what to click in any app.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light["background-100"] },
    { media: "(prefers-color-scheme: dark)", color: colors.dark["background-100"] },
  ],
};

// Light by default; dark follows the system. Set before paint so the page never flashes.
const theme = `document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
