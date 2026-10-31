"use client";
// Where you are, and what you're doing there: pick one of each and the picture shows Tandrix on it.
import { useState, type ReactNode } from "react";

export interface Place {
  name: string;
  tasks: Array<{ name: string; scene: ReactNode }>;
}

function Choices({
  title,
  items,
  chosen,
  onChoose,
}: {
  title: string;
  items: string[];
  chosen: number;
  onChoose: (i: number) => void;
}) {
  return (
    <div>
      <h3 className="mb-3.5 text-[26px] font-medium tracking-[-0.03em]">{title}</h3>
      <ul className="m-0 grid list-none gap-1 p-0">
        {items.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              aria-pressed={i === chosen}
              onClick={() => onChoose(i)}
              className="flex min-h-10 w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-1.5 text-left text-lg text-soft transition-colors duration-150 before:h-[1.5px] before:w-3.5 before:bg-current before:transition-[width] before:duration-200 before:content-[''] hover:text-ink focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:font-medium aria-pressed:text-ink aria-pressed:before:w-[22px] aria-pressed:before:bg-highlight"
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Explorer({ places }: { places: Place[] }) {
  const [p, setP] = useState(0);
  const [t, setT] = useState(0);
  const place = places[p]!;
  const task = place.tasks[Math.min(t, place.tasks.length - 1)]!;
  return (
    <div className="grid grid-cols-2 items-center gap-8 lg:grid-cols-[200px_minmax(0,1fr)_220px] lg:gap-12">
      <Choices
        title="Where"
        items={places.map((pl) => pl.name)}
        chosen={p}
        onChoose={(i) => {
          setP(i);
          setT(0);
        }}
      />
      {/* Scenes are drawn straight on the band, no frame. */}
      <div className="relative order-3 col-span-full [--fig-ground:var(--mist)] lg:order-none lg:col-span-1">
        <div className="relative grid aspect-[4/5] place-items-center min-[601px]:aspect-[16/11]">
          <div
            key={`${p}-${t}`}
            className="relative flex h-full w-[min(100%,640px)] items-center justify-center motion-safe:animate-enter"
          >
            {task.scene}
          </div>
        </div>
      </div>
      <Choices
        title="Task"
        items={place.tasks.map((tk) => tk.name)}
        chosen={place.tasks.indexOf(task)}
        onChoose={setT}
      />
    </div>
  );
}
