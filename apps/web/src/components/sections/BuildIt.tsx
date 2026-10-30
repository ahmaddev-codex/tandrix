// Build it with Tandrix: the kit assembles as you scroll.
import { KIT_GHOSTS, KIT_LAYERS } from "@/components/figures/kit/art";
import { Assemble } from "@/components/widgets/Assemble";
import { Section, SectionHead } from "./Section";

export function BuildIt() {
  return (
    <Section
      id="build"
      labelledBy="build-title"
      presence={{ state: "doing", label: "Checking each part" }}
      className="max-w-none"
    >
      <SectionHead
        id="build-title"
        title="Build it with Tandrix"
        lead="Scroll to put the kit together. Each part is checked as it lands, the way Tandrix checks your build from a photo."
      />
      <Assemble layers={KIT_LAYERS} ghosts={KIT_GHOSTS} />
    </Section>
  );
}
