// Show me: Tandrix's pointer travels to the control you ask about, rings it, and says what it does.
// Drawn straight on the page, no card.
import { ARM, CARRIAGE, HEAD_HIGH, HOUSING, PLUNGER, RAIL, RINGS, STATIC } from "./art";
import { PointerLive } from "./live";

export function PointerFigure() {
  return (
    // Solids are filled with the ground they sit on, so they hide what's behind them.
    <div className="iso mx-auto w-[min(100%,960px)] bg-transparent [--anatomy-card:var(--fig-ground,var(--background-100))] [--anatomy-paper:var(--fig-ground,var(--background-100))]">
      <PointerLive
        art={STATIC}
        rings={RINGS}
        rail={RAIL}
        carriage={CARRIAGE}
        plunger={PLUNGER}
        housing={HOUSING}
        arm={ARM}
        sled={HEAD_HIGH}
      />
    </div>
  );
}
