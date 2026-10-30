// Questions: the answers people look for, the first one open.
import { faqs } from "@/content/home";
import { Section, SectionHead } from "./Section";

export function Faq() {
  return (
    <Section
      id="faq"
      labelledBy="faq-title"
      presence={{ state: "answering", label: "Answering" }}
      className="grid items-start gap-[clamp(32px,6vw,96px)] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
    >
      <SectionHead
        id="faq-title"
        align="start"
        title="Questions"
        lead="What Tandrix does, how it keeps you in control, and what stays on your Mac."
        className="mb-0"
      />
      <div className="grid gap-2.5">
        {faqs.map((f, i) => (
          <details
            key={f.q}
            id={f.id}
            open={i === 0}
            className="group scroll-mt-6 rounded-[18px] bg-mist transition-colors duration-200 open:bg-[color-mix(in_srgb,var(--highlight)_8%,var(--mist))]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-lg font-medium tracking-[-0.01em] focus-visible:rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              {/* A plus that turns into a minus. */}
              <span
                aria-hidden="true"
                className="relative size-8 flex-none rounded-full bg-paper group-open:bg-highlight group-open:text-white before:absolute before:top-1/2 before:left-1/2 before:h-[1.6px] before:w-3 before:-translate-1/2 before:bg-current before:content-[''] after:absolute after:top-1/2 after:left-1/2 after:h-[1.6px] after:w-3 after:-translate-1/2 after:rotate-90 after:bg-current after:transition-transform after:duration-200 after:content-[''] group-open:after:rotate-0"
              />
            </summary>
            <p className="max-w-[62ch] px-[22px] pb-[22px] text-base leading-[1.6] text-text-2">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
