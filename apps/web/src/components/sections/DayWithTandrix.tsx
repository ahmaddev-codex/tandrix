// A day with Tandrix: four moments on one desk.
import { DayTimeline } from "@/components/widgets/DayTimeline";
import { moments } from "@/content/home";
import { Section, SectionHead } from "./Section";

export function DayWithTandrix() {
  return (
    <Section
      id="day"
      band
      labelledBy="day-title"
      presence={{ state: "answering", label: "Answering" }}
    >
      <SectionHead
        id="day-title"
        title="A day with Tandrix"
        lead="Learn the app, fix the setting, build the thing, hand off the errand. One assistant, on your Mac and your iPhone."
      />
      <DayTimeline moments={moments} />
    </Section>
  );
}
