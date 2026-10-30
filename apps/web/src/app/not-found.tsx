import { BrandWordmark } from "@tandrix/ui/web";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-page p-6 text-center text-ink">
      <BrandWordmark href="/" size="lg" />
      <h1 className="heading-32 mt-2">That page got away.</h1>
      <p className="max-w-[44ch] text-[17px] leading-[1.6] text-text-2">
        Whatever you were looking for isn&apos;t here. Tell Tandrix what you want to get done
        instead.
      </p>
      <a
        href="/"
        className="inline-flex min-h-12 items-center rounded-full bg-highlight px-[26px] py-2 text-[15px] font-semibold text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-focus"
      >
        Back home
      </a>
    </main>
  );
}
