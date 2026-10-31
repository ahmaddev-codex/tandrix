// The dark footer: what Tandrix is, every page by kind, and where to get it.
import { BrandWordmark } from "@tandrix/ui/web";
import { Cta } from "@/components/ui/Cta";
import { footer } from "@/content/site";
import { IPHONE_DOWNLOAD_URL, MAC_DOWNLOAD_URL, SOURCE_URL, isExternal } from "@/lib/downloads";

const link =
  "text-[15px] text-white/[0.82] no-underline hover:text-white hover:underline hover:underline-offset-[5px]";

export function SiteFooter() {
  return (
    <footer className="mx-auto mb-frame grid w-page-frame gap-12 rounded-[28px] bg-[#0b0b0c] px-gutter pt-11 pb-7 text-white">
      <div className="flex flex-wrap justify-between gap-12">
        <div className="grid max-w-[380px] content-start gap-[18px]">
          <BrandWordmark href="/" size="lg" className="text-white no-underline [&_*]:text-white" />
          <p className="text-base leading-normal text-white/[0.78]">
            One assistant for everything you want to get done, on your Mac and your iPhone.
          </p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
              Mac
            </Cta>
            <Cta
              href={IPHONE_DOWNLOAD_URL}
              tone="outline"
              external={isExternal(IPHONE_DOWNLOAD_URL)}
            >
              iPhone
            </Cta>
          </div>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-12 gap-y-9 sm:grid-cols-3 sm:gap-x-[clamp(40px,6vw,88px)]"
        >
          {footer.map((col) => (
            <div key={col.title} className="grid content-start gap-3.5">
              <p className="text-[13px] font-medium text-white/50">{col.title}</p>
              <ul className="m-0 grid list-none gap-3 p-0">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  </li>
                ))}
                {col.title === "Trust" && SOURCE_URL ? (
                  <li>
                    <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={link}>
                      Source
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-sm text-white/50">
        <span>© 2026 Tandrix</span>
        <a href="/safety" className="text-inherit underline">
          How Tandrix handles your data
        </a>
      </div>
    </footer>
  );
}
