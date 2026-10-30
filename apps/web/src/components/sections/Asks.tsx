// Ask it like you'd ask a friend: a row of real asks, each with its scene and the spoken reply.
import { HearIt } from "@/components/ui/HearIt";
import { asks } from "@/content/home";
import { Section, SectionHead } from "./Section";

export function Asks() {
  return (
    <Section wide labelledBy="asks-title">
      <SectionHead
        id="asks-title"
        title="Ask it like you'd ask a friend"
        lead="Plain words in, the next step out, spoken aloud."
        className="pr-gutter"
      />
      <div
        tabIndex={0}
        aria-label="Examples"
        className="grid snap-x snap-mandatory auto-cols-[min(400px,84vw)] grid-flow-col justify-[safe_center] gap-4 overflow-x-auto pr-gutter pb-3 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus [&::-webkit-scrollbar]:hidden"
      >
        {asks.map((a) => (
          <article key={a.ask} className="grid snap-start grid-rows-[auto_1fr]">
            <div className="flex aspect-[4/3]">{a.figure}</div>
            <div className="grid content-start justify-items-start gap-3 px-1 pt-3">
              <p className="text-[13px] font-medium text-text-2">{a.when}</p>
              <p className="text-2xl leading-[1.15] font-medium tracking-[-0.03em]">“{a.ask}”</p>
              <p className="grid gap-1 rounded-[14px] bg-paper p-3.5 text-[15px] leading-[1.45]">
                <span className="text-xs font-semibold text-highlight">Tandrix</span>
                {a.reply}
              </p>
              <HearIt line={a.line} label="Hear the reply" tone="light" />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
