// See what it can do for you: places and tasks, each with its scene.
import { Explorer } from "@/components/widgets/Explorer";
import { places } from "@/content/home";
import { Section, SectionHead } from "./Section";

export function Explore() {
  return (
    <Section
      id="explore"
      band
      labelledBy="explore-title"
      presence={{ state: "thinking", label: "Thinking" }}
    >
      <SectionHead id="explore-title" title="See what it can do for you" />
      <Explorer places={places} />
    </Section>
  );
}
