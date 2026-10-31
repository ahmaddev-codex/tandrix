import "@tandrix/ui/tokens.css";
import "./globals.css";
import { colors } from "@tandrix/ui";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Tandrix: tell it what you want done",
  description:
    "Tandrix sees your screen and what's in front of your camera, points at the answer, and checks every step with you. On your Mac and your iPhone.",
  openGraph: {
    title: "Tandrix: tell it what you want done",
    description:
      "Tandrix sees your screen and what's in front of your camera, points at the answer, and checks every step with you.",
    type: "website",
    siteName: "Tandrix",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Tandrix: tell it what you want done. It shows you the way.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tandrix: tell it what you want done",
    description:
      "Tandrix sees your screen and what's in front of your camera, points at the answer, and checks every step with you.",
    images: ["/og.png"],
  },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light["background-100"] },
    { media: "(prefers-color-scheme: dark)", color: colors.dark["background-100"] },
  ],
};

// Apply stored theme override or system preference before paint to prevent FOUC.
const themeScript = `(function(){try{var s=localStorage.getItem("color-scheme");var m=document.querySelector('meta[name="color-scheme"]');var d=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var t=s==="dark"||s==="light"?s:d;document.documentElement.dataset.theme=t;if(m)m.content=s==="dark"||s==="light"?s:"light dark";}catch(e){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
