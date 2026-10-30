// The homepage: sections in reading order. Copy lives in @/content/home.
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ScrollReveals } from "@/components/motion/ScrollReveals";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { StickyPresence } from "@/components/motion/StickyPresence";
import { Asks } from "@/components/sections/Asks";
import { BuildIt } from "@/components/sections/BuildIt";
import { Capabilities } from "@/components/sections/Capabilities";
import { Closing } from "@/components/sections/Closing";
import { DayWithTandrix } from "@/components/sections/DayWithTandrix";
import { Explore } from "@/components/sections/Explore";
import { Faq } from "@/components/sections/Faq";
import { FromTheManual } from "@/components/sections/FromTheManual";
import { GetTandrix } from "@/components/sections/GetTandrix";
import { Hero } from "@/components/sections/Hero";
import { ShowMe } from "@/components/sections/ShowMe";
import { Uses } from "@/components/sections/Uses";
import { WhatItDoes } from "@/components/sections/WhatItDoes";

export default function HomePage() {
  return (
    <div id="top" className="overflow-x-clip bg-page text-ink">
      <SmoothScroll />
      {/* At the top level, so its stacking order isn't trapped inside the hero's. */}
      <StickyPresence />
      <Hero />
      <ScrollReveals>
        <main>
          <WhatItDoes />
          <ShowMe />
          <DayWithTandrix />
          <Uses />
          <BuildIt />
          <Explore />
          <FromTheManual />
          <Asks />
          <Capabilities />
          <GetTandrix />
          <Faq />
        </main>
      </ScrollReveals>
      <Closing />
      <SiteFooter />
    </div>
  );
}
