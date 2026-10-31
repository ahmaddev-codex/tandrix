// The site's inner pages: a sky header with the site's header in it, then sections in the homepage's
// language (big tight headings, a grey tray of white cards, photos with Tandrix's rings on them),
// then the footer.
import { Icon } from "@tandrix/ui/web";
import type { ComponentProps, ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { Presence } from "@/components/sections/Section";
import { ActivePill } from "@/components/ui/ActivePill";
import { Cta } from "@/components/ui/Cta";
import { cn } from "@/lib/cn";
import { MAC_DOWNLOAD_URL, isExternal } from "@/lib/downloads";

type IconName = ComponentProps<typeof Icon>["name"];

export const heading =
  "text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]";
export const cardShadow =
  "rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)]";

export function PageShell({
  pill,
  title,
  lead,
  children,
}: {
  pill: Presence;
  title: ReactNode;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page text-ink [--gap:clamp(72px,9vw,128px)]">
      <header className="m-frame grid rounded-[28px] bg-technical-sky px-gutter pb-[clamp(56px,8vw,104px)] text-white">
        <SiteHeader />
        <div className="mt-[clamp(28px,6vw,72px)] grid max-w-[760px] justify-items-start gap-[22px]">
          <ActivePill state={pill.state} label={pill.label} />
          <h1 className="text-[clamp(40px,5.6vw,72px)] leading-[1.02] font-medium tracking-[-0.05em] text-balance">
            {title}
          </h1>
          <p className="max-w-[600px] text-lg leading-[1.55] text-white/[0.94]">{lead}</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1240px] gap-(--gap) px-gutter py-(--gap)">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** A heading with what it covers, as a list beside a picture; `flip` puts the picture first. */
export function Feature({
  id,
  title,
  lead,
  points,
  media,
  flip,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  points: Array<{ title: string; body: ReactNode }>;
  media: ReactNode;
  flip?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "grid scroll-mt-6 grid-cols-1 items-center gap-[clamp(32px,6vw,80px)] min-[761px]:grid-cols-2",
        flip && "min-[761px]:[&>:first-child]:order-2",
      )}
    >
      <div>
        <h2 id={`${id}-title`} className={heading}>
          {title}
        </h2>
        {lead ? (
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-text-2">{lead}</p>
        ) : null}
        <dl className="mt-7 grid gap-[22px] [&_dd]:mt-1.5 [&_dd]:text-base [&_dd]:leading-[1.6] [&_dd]:text-text-2 [&_dt]:text-lg [&_dt]:font-medium">
          {points.map((p) => (
            <div key={p.title}>
              <dt>{p.title}</dt>
              <dd>{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="grid gap-4">{media}</div>
    </section>
  );
}

/** The grey tray of white cards, each with a solid blue icon. */
export function CardTray({
  id,
  title,
  lead,
  cards,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  cards: Array<{ icon: IconName; title: string; body: ReactNode }>;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <div className="grid max-w-[640px] gap-3">
        <h2 id={`${id}-title`} className={heading}>
          {title}
        </h2>
        {lead ? <p className="text-[17px] leading-[1.6] text-text-2">{lead}</p> : null}
      </div>
      <div
        className={cn(
          "mt-8 grid grid-cols-1 gap-3 rounded-[30px] bg-mist p-3 min-[761px]:grid-cols-2",
          cards.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4",
        )}
      >
        {cards.map((c) => (
          <article
            key={c.title}
            className="grid content-start gap-3 rounded-[20px] bg-paper p-[22px] [&_h3]:text-xl [&_h3]:font-medium [&_h3]:tracking-[-0.02em] [&_p]:text-[15px] [&_p]:leading-[1.55] [&_p]:text-text-2"
          >
            <Icon name={c.icon} size={24} weight="fill" className="text-highlight" />
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** The page's last word: get Tandrix, or read on. */
export function Closer({ next }: { next: { href: string; label: string } }) {
  return (
    <section className="flex flex-wrap justify-center gap-3">
      <Cta href={MAC_DOWNLOAD_URL} tone="ink" external={isExternal(MAC_DOWNLOAD_URL)}>
        Get Tandrix
      </Cta>
      <Cta href={next.href} tone="light" arrow={false}>
        {next.label}
      </Cta>
    </section>
  );
}
