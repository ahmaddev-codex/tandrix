// Public read-only job report (/r/[token]). Never cached or indexed: links expire and can be turned off.
import { formatDateTime } from "@tandrix/ui";
import { Icon, JobReport, Notice, StatusChip } from "@tandrix/ui/web";
import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchSharedReport,
  reportMeta,
  safetyGateLabel,
  toReportStepProps,
} from "../../../lib/report";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job report — Tandrix",
  description: "Read-only job report shared from Tandrix.",
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await fetchSharedReport(token);

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.wordmark}>
            Tandrix
          </Link>
          <span className={styles.badge}>
            <Icon name="file" />
            Shared report · Read-only
          </span>
        </div>
      </header>

      <main className={styles.main}>
        {result.kind === "gone" ? (
          <section className={styles.stateBox} aria-label="Report unavailable">
            <Notice tone="neutral" title="Report link unavailable">
              {result.message}
            </Notice>
            <div>
              <Link className="tx-btn tx-btn-secondary tx-btn-md" href="/">
                Back to Tandrix
              </Link>
            </div>
          </section>
        ) : result.kind === "error" ? (
          <section className={styles.stateBox} aria-label="Report error">
            <Notice tone="error" title="Couldn't load this report">
              {result.message}
            </Notice>
            <div>
              <Link className="tx-btn tx-btn-secondary tx-btn-md" href="/">
                Back to Tandrix
              </Link>
            </div>
          </section>
        ) : (
          <>
            <JobReport
              title={result.report.job.title}
              meta={reportMeta(result.report)}
              counts={result.report.counts}
              steps={result.report.steps.map((step) => ({
                ...toReportStepProps(step),
                thumbnail: step.evidence ? (
                  <img
                    src={step.evidence.url}
                    alt={
                      step.evidence.kind === "screenshot"
                        ? `Step ${step.index} screenshot`
                        : `Step ${step.index} photo`
                    }
                    loading="lazy"
                  />
                ) : undefined,
              }))}
            />

            {result.report.safety.length > 0 || result.report.parts ? (
              <section className={styles.details} aria-label="Safety and parts summary">
                {result.report.safety.length > 0 ? (
                  <div className={styles.detailCard}>
                    <h3 className="heading-16">Safety confirmations</h3>
                    <ul className={styles.detailList}>
                      {result.report.safety.map((s) => (
                        <li key={`${s.stepIndex}-${s.gate}`} className={styles.detailRow}>
                          <div className={styles.detailMain}>
                            <StatusChip status="verified">{safetyGateLabel[s.gate]}</StatusChip>
                            <span className={styles.detailStep}>Step {s.stepIndex}</span>
                          </div>
                          <span className={styles.detailTime}>{formatDateTime(s.confirmedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {result.report.parts ? (
                  <div className={styles.detailCard}>
                    <h3 className="heading-16">Parts check</h3>
                    <dl className={styles.partsGrid}>
                      <div>
                        <dt>Found</dt>
                        <dd>{result.report.parts.found}</dd>
                      </div>
                      <div>
                        <dt>Possible match</dt>
                        <dd>{result.report.parts.possible}</dd>
                      </div>
                      <div>
                        <dt>Missing</dt>
                        <dd
                          className={result.report.parts.missing > 0 ? styles.partsWarn : undefined}
                        >
                          {result.report.parts.missing}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <span>Tandrix</span>
        {result.kind === "ok" ? (
          <span>Report generated {formatDateTime(result.report.generatedAt)}</span>
        ) : (
          <Link href="/">tandrix.dev</Link>
        )}
      </footer>
    </div>
  );
}
