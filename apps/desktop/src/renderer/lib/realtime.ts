// Live updates over Supabase Realtime (RLS applies: only the user's own rows arrive).
import type { Surface } from "@tandrix/contracts";
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export interface IncomingHandoff {
  jobId: string;
  /** The job step to open; absent when the job was sent without one. */
  jobStepId?: string;
  from: Surface;
}

const surfaces: readonly string[] = ["phone", "glasses", "desktop"];

/** A new events row that sends a job to the Mac, or null for anything else. */
export function handoffToMac(row: Record<string, unknown>): IncomingHandoff | null {
  if (row.type !== "handoff" || typeof row.job_id !== "string") return null;
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  if (payload.to !== "desktop") return null;
  const from =
    typeof row.surface === "string" && surfaces.includes(row.surface) ? row.surface : "phone";
  return {
    jobId: row.job_id,
    ...(typeof payload.job_step_id === "string" ? { jobStepId: payload.job_step_id } : {}),
    from: from as Surface,
  };
}

/** Calls back when the phone (or glasses) sends a job to the Mac. */
export function useHandoffsToMac(userId: string, onHandoff: (h: IncomingHandoff) => void) {
  const latest = useRef(onHandoff);
  latest.current = onHandoff;
  useEffect(() => {
    const channel = supabase
      .channel(`handoffs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: "type=eq.handoff" },
        (p) => {
          const h = handoffToMac(p.new as Record<string, unknown>);
          if (h) latest.current(h);
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [userId]);
}

/**
 * Calls back when the job or its steps change on any device, and once the subscription is live
 * (to catch anything missed while connecting). Bursts are folded into one call.
 */
export function useJobChanges(jobId: string | undefined, onChange: () => void) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!jobId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), 250);
    };
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        changed,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_steps", filter: `job_id=eq.${jobId}` },
        changed,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") changed();
      });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [jobId]);
}
