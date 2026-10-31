// From the manual to your next step: drag between the page and Tandrix's step.
import { BeforeAfter } from "@/components/widgets/BeforeAfter";
import { Section, SectionHead, Soft } from "./Section";

export function FromTheManual() {
  return (
    <Section
      id="manual"
      labelledBy="manual-title"
      presence={{ state: "thinking", label: "Reading the manual" }}
    >
      <SectionHead
        id="manual-title"
        title={
          <>
            From the manual <Soft>to your next step</Soft>
          </>
        }
        lead="Tandrix reads the real manual and turns each page into one clear step, with the part ringed. Drag to compare."
      />
      <BeforeAfter />
    </Section>
  );
}
