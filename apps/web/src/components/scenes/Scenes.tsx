// Small cards Tandrix shows, drawn in code so they stay sharp at any size. Decorative: each is
// aria-hidden and the copy beside it says what it shows.
import { ActivePill } from "@/components/ui/ActivePill";
import { Clip } from "@/components/ui/Clip";
import { cn } from "@/lib/cn";
import { Tick } from "./parts";

export { PointerArrow } from "./parts";

const card =
  "grid content-start gap-1.5 rounded-[18px] bg-white p-4 text-left font-sans text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)] [&_p]:m-0 [&_p]:text-[12.5px] [&_p]:leading-[1.45] [&_p]:text-[#5c5c5a]";
const cardTitle = "text-[15px] font-semibold";

/** A step checked from a photo, as the phone shows it. */
export function CheckCard() {
  return (
    <div className={card} aria-hidden="true">
      <div className="flex items-center justify-between text-[11px] text-[#6e6e73]">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-[3px] font-semibold text-blue-900">
          <Tick /> Verified
        </span>
        <span>Step 3 of 6</span>
      </div>
      <b className={cardTitle}>Fit the drill bit</b>
      <p>The bit is seated and the chuck is tight.</p>
      <span className="mt-1.5 h-[5px] rounded-[3px] bg-[#ececec]">
        <i className="block h-full w-1/2 rounded-[inherit] bg-[#111]" />
      </span>
    </div>
  );
}

/** A spoken exchange: what was asked and what Tandrix said back. */
export function VoiceCard({ ask, reply }: { ask: string; reply: string }) {
  return (
    <div
      className="grid content-start gap-2.5 rounded-[18px] bg-[#111] p-4 text-left font-sans text-white shadow-soft"
      aria-hidden="true"
    >
      <p className="m-0 max-w-[85%] justify-self-end rounded-[14px_14px_4px_14px] bg-[#2a2b2d] px-3 py-[9px] text-[13px]">
        {ask}
      </p>
      <p className="m-0 flex items-start gap-2.5 text-[13.5px] leading-[1.45]">
        <span className="inline-flex h-[18px] flex-none items-center gap-0.5">
          {[50, 85, 100, 85, 50].map((h, i) => (
            <i
              key={i}
              className="w-[3px] rounded-[2px] bg-highlight motion-safe:animate-meter"
              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </span>
        {reply}
      </p>
    </div>
  );
}

/** Someone at their Mac, holding ⌥⌘ and saying what they want, with the real listening pill. */
export function TalkScene({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative aspect-[6/5] w-full overflow-hidden bg-[#0b0b0c]", className)}
      aria-hidden="true"
    >
      <Clip
        name="typing-on-laptop"
        className="absolute inset-0 size-full object-cover object-[58%_50%]"
      />
      <div className="absolute top-4 left-4 flex">
        <ActivePill state="listening" label="Listening" keys="⌥⌘" hint="Let go to ask" />
      </div>
      <p className="absolute inset-x-4 bottom-4 m-0 text-center text-[clamp(15px,2.4vw,19px)] leading-[1.3] font-medium text-white">
        “Book my dentist for Thursday at ten”
      </p>
    </div>
  );
}

/** A safety gate: the step waits until the user confirms. */
export function GateCard() {
  const button = "flex-1 rounded-full px-1.5 py-2 text-center";
  return (
    <div className={card} aria-hidden="true">
      <span className="grid size-7 place-items-center rounded-lg bg-[#111] font-bold text-white">
        !
      </span>
      <b className={cardTitle}>Before you continue</b>
      <p>Unplug the power. Tandrix waits until you say it&apos;s done.</p>
      <span className="mt-1 flex gap-1.5 text-xs font-medium">
        <span className={cn(button, "shadow-[inset_0_0_0_1px_#d6d6d6]")}>Not yet</span>
        <span className={cn(button, "bg-[#111] text-white")}>It&apos;s unplugged</span>
      </span>
    </div>
  );
}
