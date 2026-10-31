// Everything it does, in one assistant.
import { CapabilityMap } from "@/components/widgets/CapabilityMap";
import { Section, SectionHead, Soft } from "./Section";

export function Capabilities() {
  return (
    <Section id="map" labelledBy="map-title" presence={{ state: "answering", label: "Ready" }}>
      <SectionHead
        id="map-title"
        title={
          <>
            Everything it does, <Soft>in one assistant</Soft>
          </>
        }
      />
      <CapabilityMap />
    </Section>
  );
}
