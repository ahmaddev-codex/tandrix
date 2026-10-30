// The first screen: a live sky in a rounded frame, what Tandrix does in a sentence, and the
// turning ring of real moments.
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ActivePill } from "@/components/ui/ActivePill";
import { Cta } from "@/components/ui/Cta";
import { Carousel3D } from "@/components/widgets/Carousel3D";
import { ring } from "@/content/home";
import { MAC_DOWNLOAD_URL, isExternal } from "@/lib/downloads";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      data-presence-off
      className="relative isolate m-frame flex h-[calc(100svh-var(--frame)*2)] min-h-[620px] flex-col overflow-hidden rounded-[28px] bg-hero-sky px-gutter pb-[clamp(44px,9vh,96px)] text-white before:absolute before:inset-0 before:-z-10 before:bg-hero-veil before:content-['']"
    >
      <SiteHeader />
      <div className="relative z-[2] mx-auto mt-auto grid max-w-[1000px] justify-items-center gap-5 pt-[clamp(16px,3vw,40px)] text-center motion-safe:[&>*]:animate-rise motion-safe:[&>:nth-child(2)]:[animation-delay:80ms] motion-safe:[&>:nth-child(3)]:[animation-delay:160ms] motion-safe:[&>:nth-child(4)]:[animation-delay:240ms]">
        <ActivePill state="listening" label="Listening" keys="⌥⌘" hint="Let go to ask" />
        <h1
          id="hero-title"
          className="text-[clamp(38px,min(5.6vw,8vh),78px)] leading-[1.02] font-medium tracking-[-0.05em] text-balance [text-shadow:0_2px_30px_rgba(10,60,140,0.25)]"
        >
          Tell it what you want done.
          <span className="block text-white/[0.72]">It shows you the way.</span>
        </h1>
        <p className="max-w-[520px] text-lg leading-normal text-white/[0.94] [text-shadow:0_1px_14px_rgba(10,60,140,0.3)]">
          Tandrix sees your screen and what&apos;s in front of your camera, points at the answer,
          and checks every step with you.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-center gap-3">
          <Cta href="#day" tone="glass" arrow={false}>
            See how it works
          </Cta>
          <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
            Download for Mac
          </Cta>
        </div>
      </div>
      <Carousel3D items={ring} />
    </section>
  );
}
