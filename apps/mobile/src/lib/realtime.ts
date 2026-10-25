// Live job updates over Supabase Realtime (RLS applies: only the user's own rows arrive).
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Calls back when the job or its steps change on any device (the Mac checking a step, a
 * handoff), and once the subscription is live to catch anything missed while connecting.
 * Bursts are folded into one call.
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
      .channel(`job-${jobId}-${Math.random().toString(36).slice(2)}`)
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
