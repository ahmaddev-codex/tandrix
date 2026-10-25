// A phone showing one step of a project: the camera frame with the part marked, and the step.
import { StepCard } from "@tandrix/ui/web";
import { RackIllustration } from "./RackIllustration";
import styles from "./PhoneMock.module.css";

export function PhoneMock() {
  return (
    <figure className={styles.phone} aria-label="Tandrix on a phone, guiding one step">
      <div className={styles.screen}>
        <div className={styles.frame}>
          <RackIllustration />
          <span className={styles.label} aria-hidden>
            Left rail, 5U to 6U
          </span>
        </div>
        <StepCard
          index={3}
          total={6}
          title="Fit the rails for the server"
          body="Hook each rail into the marked holes, then push until it clicks."
          status="progress"
          source="Manual p.7"
        />
      </div>
    </figure>
  );
}
