// Point at anything: the pointing machine, live.
import { PointerFigure } from "@/components/figures/pointer/figure";
import { Section, SectionHead, Soft } from "./Section";

export function ShowMe() {
  return (
    <Section id="try" labelledBy="try-title" presence={{ state: "looking", label: "Show me" }}>
      <SectionHead
        id="try-title"
        title={
          <>
            Point at anything. <Soft>It tells you what it is.</Soft>
          </>
        }
      />
      <PointerFigure />
    </Section>
  );
}
