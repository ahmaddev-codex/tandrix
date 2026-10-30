// Show me: Tandrix's pointer travels to the control you ask about, rings it, and says what it does.
// Drawn straight on the page, no card.
import "../../iso/iso.css";
import { ARM, CARRIAGE, HEAD_HIGH, HOUSING, PLUNGER, RAIL, RINGS, STATIC } from "./art";
import styles from "./pointer.module.css";
import { PointerLive } from "./live";

export function PointerFigure() {
  return (
    <div className={`iso ${styles.wrap}`}>
      <PointerLive art={STATIC} rings={RINGS} rail={RAIL} carriage={CARRIAGE} plunger={PLUNGER} housing={HOUSING} arm={ARM} sled={HEAD_HIGH} />
    </div>
  );
}
