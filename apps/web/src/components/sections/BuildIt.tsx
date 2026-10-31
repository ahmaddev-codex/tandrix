"use client";
// Build it with Tandrix: mechanical hardware assemblies that come together as you scroll.
import { useState } from "react";
import { KIT_GHOSTS, KIT_LAYERS } from "@/components/figures/kit/art";
import {
  HEIGHT as KIT_HEIGHT,
  P as KIT_P,
  PARTS as KIT_PARTS,
  WIDTH as KIT_WIDTH,
} from "@/components/figures/kit/view";
import { RACK_GHOSTS, RACK_LAYERS } from "@/components/figures/rack/art";
import {
  HEIGHT as RACK_HEIGHT,
  P as RACK_P,
  RACK_PARTS,
  WIDTH as RACK_WIDTH,
} from "@/components/figures/rack/view";
import { Assemble } from "@/components/widgets/Assemble";
import { cn } from "@/lib/cn";
import { Section, SectionHead } from "./Section";

export type BuildModel = "rack" | "kit";

export function BuildIt() {
  const [model, setModel] = useState<BuildModel>("rack");

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
        lead="Scroll to put the hardware together. Each part is checked as it lands, the way Tandrix verifies your physical build from a photo."
      />

      {/* Model Selector Tabs: 12U Server Rack and Maker Single-Board Computer */}
      <div className="mb-6 flex justify-center">
        <div
          role="tablist"
          aria-label="Hardware assembly models"
          className="inline-flex items-center gap-1.5 rounded-full bg-mist p-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={model === "rack"}
            onClick={() => setModel("rack")}
            className={cn(
              "tx-tab rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
              model === "rack" ? "bg-page text-ink shadow-sm" : "text-soft hover:text-ink",
            )}
          >
            12U Server Rack
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={model === "kit"}
            onClick={() => setModel("kit")}
            className={cn(
              "tx-tab rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
              model === "kit" ? "bg-page text-ink shadow-sm" : "text-soft hover:text-ink",
            )}
          >
            Maker Single-Board Kit
          </button>
        </div>
      </div>

      {model === "rack" ? (
        <Assemble
          key="rack"
          parts={RACK_PARTS}
          projection={RACK_P}
          width={RACK_WIDTH}
          height={RACK_HEIGHT}
          layers={RACK_LAYERS}
          ghosts={RACK_GHOSTS}
          hearLine="seated"
          hearLabel="Hear a rack check"
        />
      ) : (
        <Assemble
          key="kit"
          parts={KIT_PARTS}
          projection={KIT_P}
          width={KIT_WIDTH}
          height={KIT_HEIGHT}
          layers={KIT_LAYERS}
          ghosts={KIT_GHOSTS}
          hearLine="seated"
          hearLabel="Hear a check"
        />
      )}
    </Section>
  );
}
