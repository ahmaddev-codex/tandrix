// Questions: the answers people look for, the first one open.
import { Icon } from "@tandrix/ui/web";
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
              {/* A plus that turns into a close. */}
              <span
                aria-hidden="true"
                className="grid size-8 flex-none place-items-center rounded-full bg-paper group-open:bg-highlight group-open:text-white"
              >
                <Icon
                  name="plus"
                  size={16}
                  className="transition-transform duration-200 group-open:rotate-45"
                />
              </span>
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
