// Public read-only job report (/r/[token]). Never cached or indexed: links expire and can be turned off.
import { formatDateTime } from "@tandrix/ui";
import { Icon, JobReport, Notice, StatusChip } from "@tandrix/ui/web";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchSharedReport, reportMeta, safetyGateLabel, toReportStepProps } from "@/lib/report";

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
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-(--background-200) [--page:min(860px,calc(100vw-var(--space-6)-var(--space-6)))]">
      <header className="sticky top-0 z-10 border-b border-(--border) bg-[color-mix(in_srgb,var(--background-100)_85%,transparent)] backdrop-blur-[16px] backdrop-saturate-[180%]">
        <div className="mx-auto flex h-14 w-(--page) items-center justify-between gap-(--space-4)">
          <Link href="/" className="text-base font-semibold tracking-[-0.32px] no-underline">
            Tandrix
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs leading-4 font-medium text-text-2">
            <Icon name="file" />
            Shared report · Read-only
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-(--page) content-start gap-(--space-6) pt-(--space-8) pb-(--space-12) [&_.tx-report]:rounded-(--radius-lg) [&_.tx-report]:bg-(--background-100) [&_.tx-report]:p-(--space-4) [&_.tx-report]:shadow-(--shadow-border) min-[561px]:[&_.tx-report]:p-(--space-6)">
        {result.kind === "gone" ? (
          <section
            className="grid gap-(--space-4) rounded-(--radius-lg) bg-(--background-100) p-(--space-6) shadow-(--shadow-border) max-w-[520px]"
            aria-label="Report unavailable"
          >
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
          <section
            className="grid gap-(--space-4) rounded-(--radius-lg) bg-(--background-100) p-(--space-6) shadow-(--shadow-border) max-w-[520px]"
            aria-label="Report error"
          >
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
              <section
                className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-(--space-6)"
                aria-label="Safety and parts summary"
              >
                {result.report.safety.length > 0 ? (
                  <div className="grid content-start gap-(--space-4) rounded-(--radius-lg) bg-(--background-100) p-(--space-5) shadow-(--shadow-border)">
                    <h3 className="heading-16">Safety confirmations</h3>
                    <ul className="m-0 grid list-none gap-(--space-3) p-0">
                      {result.report.safety.map((s) => (
                        <li
                          key={`${s.stepIndex}-${s.gate}`}
                          className="flex flex-wrap items-center justify-between gap-(--space-3)"
                        >
                          <div className="inline-flex items-center gap-(--space-2)">
                            <StatusChip status="verified">{safetyGateLabel[s.gate]}</StatusChip>
                            <span className="font-mono text-xs text-text-2 tabular-nums">
                              Step {s.stepIndex}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-text-3 tabular-nums">
                            {formatDateTime(s.confirmedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {result.report.parts ? (
                  <div className="grid content-start gap-(--space-4) rounded-(--radius-lg) bg-(--background-100) p-(--space-5) shadow-(--shadow-border)">
                    <h3 className="heading-16">Parts check</h3>
                    <dl className="m-0 grid grid-cols-1 gap-(--space-3) min-[561px]:grid-cols-3 [&>div]:grid [&>div]:gap-1 [&>div]:rounded-(--radius-md) [&>div]:bg-(--background-200) [&>div]:p-(--space-3) [&_dd]:m-0 [&_dd]:text-xl [&_dd]:leading-7 [&_dd]:font-semibold [&_dd]:tabular-nums [&_dt]:text-xs [&_dt]:leading-4 [&_dt]:text-text-2">
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
                          className={
                            result.report.parts.missing > 0 ? "text-(--amber-900)" : undefined
                          }
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

      <footer className="mx-auto flex w-(--page) items-center justify-between gap-(--space-4) border-t border-(--border) py-(--space-6) text-xs text-text-3 tabular-nums [&_a]:text-text-2 [&_a]:no-underline">
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
