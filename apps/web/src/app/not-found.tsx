import { BrandWordmark } from "@tandrix/ui/web";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <BrandWordmark href="/" size="lg" />
      <h1 className="heading-32">That page got away.</h1>
      <p className={styles.lead}>
        Whatever you were looking for isn&apos;t here. Tell Tandrix what you want to get done
        instead.
      </p>
      <a className={styles.back} href="/">
        Back home
      </a>
    </main>
  );
}
