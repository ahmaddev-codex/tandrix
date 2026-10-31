// The site's pages, as the header, its menu on small screens and the footer list them.
import { GET_LABEL } from "@/lib/downloads";

export interface NavLink {
  href: string;
  label: string;
  /** One line under the label in the header's dropdown. */
  blurb?: string;
}

/** The header: a Product menu, then plain links. */
export const product: NavLink[] = [
  { href: "/mac", label: "Tandrix for Mac", blurb: "Show me, learn step by step, do it for me" },
  {
    href: "/iphone",
    label: "Tandrix for iPhone",
    blurb: "Point the camera, build from the manual",
  },
  {
    href: "/technical",
    label: "How it works",
    blurb: "What's inside, and how it keeps you in control",
  },
];

export const primary: NavLink[] = [
  { href: "/#explore", label: "Uses" },
  { href: "/safety", label: "Safety" },
  { href: "/whats-new", label: "What's new" },
];

/** The footer's columns. */
export const footer: Array<{ title: string; links: NavLink[] }> = [
  {
    title: "Product",
    links: [
      { href: "/mac", label: "Mac" },
      { href: "/iphone", label: "iPhone" },
      { href: "/whats-new", label: "What's new" },
      { href: "/#get", label: GET_LABEL },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/technical", label: "How it works" },
      { href: "/#day", label: "A day with Tandrix" },
      { href: "/#explore", label: "Uses" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/safety", label: "Safety and privacy" },
      { href: "/credits", label: "Photo and video credits" },
    ],
  },
];
