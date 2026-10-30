// The dark footer: what Tandrix is, where to go, and where to get it.
import { BrandWordmark } from "@tandrix/ui/web";
import { Cta } from "@/components/ui/Cta";
import { nav } from "@/content/home";
import { IPHONE_DOWNLOAD_URL, MAC_DOWNLOAD_URL, SOURCE_URL, isExternal } from "@/lib/downloads";

const link =
  "text-base text-white/[0.88] no-underline hover:text-white hover:underline hover:underline-offset-[5px]";

export function SiteFooter() {
  return (
    <footer className="mx-auto mb-frame grid w-page-frame gap-12 rounded-[28px] bg-[#0b0b0c] px-gutter pt-11 pb-7 text-white">
      <div className="flex flex-wrap justify-between gap-10">
        <div className="grid max-w-[420px] gap-[18px]">
          <BrandWordmark
            href="#top"
            size="lg"
            className="text-white no-underline [&_*]:text-white"
          />
          <p className="text-base leading-normal text-white/[0.78]">
            One assistant for everything you want to get done, on your Mac and your iPhone.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-[repeat(2,auto)] content-start gap-x-10 gap-y-4 sm:gap-x-[72px] sm:gap-y-[18px]"
        >
          {nav.map((n) => (
            <a key={n.href} href={n.href} className={link}>
              {n.label}
            </a>
          ))}
          <a href="/technical" className={link}>
            How Tandrix works
          </a>
          {SOURCE_URL ? (
            <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={link}>
              Source
            </a>
          ) : null}
        </nav>
      </div>
      <div className="grid gap-3.5">
        <p className="text-xl tracking-[-0.02em]">Get Tandrix</p>
        <div className="flex flex-wrap gap-2.5">
          <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
            Mac
          </Cta>
          <Cta href={IPHONE_DOWNLOAD_URL} tone="outline" external={isExternal(IPHONE_DOWNLOAD_URL)}>
            iPhone
          </Cta>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-white/50">
        <span>© 2026 Tandrix</span>
        <a href="/credits" className="text-inherit underline">
          Photo and video credits
        </a>
      </div>
    </footer>
  );
}
