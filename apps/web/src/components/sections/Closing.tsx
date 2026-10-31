// The closing banner: say it once more, with the way to get it.
import { Cta } from "@/components/ui/Cta";
import { GET_MAC_LABEL, IPHONE_DOWNLOAD_URL, MAC_DOWNLOAD_URL, isExternal } from "@/lib/downloads";

export function Closing() {
  return (
    <section
      aria-labelledby="closing-title"
      className="mx-auto mt-gap mb-frame w-page-frame rounded-[28px] bg-closing-sky px-gutter py-[clamp(64px,9vw,112px)] text-white"
    >
      <div className="grid max-w-[780px] justify-items-start gap-[22px]">
        <h2
          id="closing-title"
          className="text-[clamp(36px,4.8vw,62px)] leading-[1.04] font-medium tracking-[-0.05em]"
        >
          Say what you want done.
          <span className="block text-white/75">Tandrix takes it from there.</span>
        </h2>
        <p className="max-w-[460px] text-[17px] leading-[1.55] text-white/[0.94]">
          Learn the app, finish the task, build the thing, with every step pointed out and checked.
        </p>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
            {GET_MAC_LABEL}
          </Cta>
          {isExternal(IPHONE_DOWNLOAD_URL) ? (
            <Cta href={IPHONE_DOWNLOAD_URL} tone="glass" arrow={false} external>
              Get for iPhone
            </Cta>
          ) : null}
        </div>
      </div>
    </section>
  );
}
