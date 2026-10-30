"use client";
// Before and after: a page of the real manual, and the step Tandrix makes from it. Drag the handle
// (or use the arrow keys on it) to compare.
import { useState } from "react";
import { Photo } from "@/components/scenes/Photo";
import { sensorPhoto } from "@/components/scenes/photos";

const tag =
  "pointer-events-none absolute top-3.5 z-[2] rounded-full bg-[rgba(11,11,12,0.72)] px-3 py-[5px] text-xs font-medium text-white";

export function BeforeAfter() {
  const [x, setX] = useState(50);
  return (
    <div className="grid justify-items-center">
      <div
        style={{ ["--x" as string]: `${x}%` }}
        className="relative aspect-[3/4] w-[min(100%,980px)] overflow-hidden rounded-3xl bg-mist shadow-soft select-none has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-focus min-[701px]:aspect-[16/10]"
      >
        {/* After: the step card Tandrix writes from that page. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 isolate z-0 grid place-items-center bg-step-sky p-[4%]"
        >
          <div className="grid w-[min(400px,100%)] gap-2 rounded-[20px] bg-white p-3.5 font-sans text-[#0b0b0c] min-[701px]:gap-3 min-[701px]:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[#f0f0f0] px-2.5 py-[3px] text-xs font-medium text-[#555]">
                To do
              </span>
              <span className="text-xs text-[#6e6e73]">Step 4 of 9 · Manual p. 4</span>
            </div>
            <b className="text-[19px] font-semibold tracking-[-0.02em]">
              Fit the ultrasonic sensor
            </b>
            <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_#ececec]">
              <Photo spec={sensorPhoto} />
            </div>
            <ol className="m-0 grid list-decimal gap-1.5 pl-[18px] text-xs leading-[1.45] text-[#3a3a3c] min-[701px]:text-[13.5px]">
              <li>Clip the sensor onto the front of the chassis.</li>
              <li>Plug its cable into port 3 on the main board.</li>
              <li>Take a photo when it’s on. Tandrix checks it.</li>
            </ol>
          </div>
        </div>
        {/* Before: the manual as printed. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] grid place-items-center bg-white [clip-path:inset(0_calc(100%-var(--x))_0_0)]"
        >
          <img src="/photos/robot-manual.jpeg" alt="" className="size-[92%] object-contain" />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-(--x) z-[2] w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <i className="absolute top-1/2 left-1/2 size-11 -translate-1/2 rounded-full bg-drag-handle shadow-[0_0_0_4px_rgba(255,255,255,0.85)]" />
        </span>
        <span className={`${tag} left-3.5`}>The manual</span>
        <span className={`${tag} right-3.5`}>Tandrix’s step</span>
        {/* The range covers the frame: drag anywhere, and the keyboard works on it. */}
        <input
          type="range"
          min={0}
          max={100}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          aria-label="Compare the manual page with Tandrix's step"
          className="absolute inset-0 z-[3] m-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
    </div>
  );
}
