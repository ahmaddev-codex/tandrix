// The user's projects and each active one's next action, held once for the tab screens. Switching
// tabs shows what's held straight away; the list is fetched again only after Realtime reports a
// change (from this phone, the Mac or the web) or when it's old, and a project's details are
// fetched again only when that project changed.
import type { Job } from "@tandrix/contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useSyncExternalStore } from "react";
import { api, writes } from "./api";
import { actionFor, type HomeAction } from "./home";
import { supabase } from "./supabase";

export interface JobsState {
  jobs?: Job[];
  actions?: HomeAction[];
  /** Some next actions are still being worked out. */
  actionsLoading: boolean;
  error?: string;
}

/** Without any change event, a list this old is fetched again when a tab is opened. */
const MAX_AGE_MS = 5 * 60_000;
/** Bursts of change events (a step and its project together) fold into one refetch. */
const SETTLE_MS = 400;
const BATCH = 20;

let state: JobsState = { actionsLoading: false };
const listeners = new Set<() => void>();
function set(patch: Partial<JobsState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

let fetchedAt = 0;
let stale = true;
let inflight: Promise<void> | undefined;
/** The next action per project, with the project row it was worked out from. */
const actionCache = new Map<string, { key: string; action: HomeAction }>();
const keyFor = (job: Job) =>
  `${job.updatedAt}:${job.currentStepId ?? ""}:${job.activeSurface}:${job.status}`;

async function fetchAll() {
  stale = false;
  const jobs = await api.listAllJobs();
  fetchedAt = Date.now();
  const active = jobs.filter((job) => job.status === "active");
  const changed = active.filter((job) => actionCache.get(job.id)?.key !== keyFor(job));
  set({ jobs, error: undefined, actionsLoading: changed.length > 0 });
  for (let i = 0; i < changed.length; i += BATCH) {
    await Promise.allSettled(
      changed.slice(i, i + BATCH).map(async (job) => {
        const action = actionFor(await api.getJob(job.id));
        actionCache.set(job.id, { key: keyFor(job), action });
      }),
    );
  }
  set({
    actions: active.flatMap((job) => {
      const held = actionCache.get(job.id);
      return held ? [held.action] : [];
    }),
    actionsLoading: false,
  });
}

/** Fetches what's out of date; `force` (pull to refresh) fetches the list regardless. */
export function refreshJobs(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && !stale && Date.now() - fetchedAt < MAX_AGE_MS) return Promise.resolve();
  inflight = fetchAll()
    .catch((e: Error) => {
      stale = true;
      set({ error: e.message, actionsLoading: false });
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** Tab screens in focus; background refetches wait until one is. */
let focused = 0;

let channel: ReturnType<typeof supabase.channel> | undefined;
let settle: ReturnType<typeof setTimeout> | undefined;
function changedJob(jobId: string | undefined) {
  if (jobId) actionCache.delete(jobId);
  stale = true;
  clearTimeout(settle);
  // Only a tab on show needs it now; the others catch up when opened.
  settle = setTimeout(() => focused > 0 && void refreshJobs(), SETTLE_MS);
}

// This phone's own changes count straight away, before (or without) Realtime.
writes.add(changedJob);

function listen() {
  if (channel) return;
  type Row = { id?: string; job_id?: string };
  channel = supabase
    .channel(`jobs-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, (p) =>
      changedJob(((p.new as Row)?.id ?? (p.old as Row)?.id) || undefined),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "job_steps" }, (p) =>
      changedJob(((p.new as Row)?.job_id ?? (p.old as Row)?.job_id) || undefined),
    )
    // After a reconnect, changes made while away weren't heard: check the list once.
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && fetchedAt > 0) changedJob(undefined);
    });
}

/** Forgets everything held, on sign-out. */
export function resetJobs() {
  clearTimeout(settle);
  if (channel) void supabase.removeChannel(channel);
  channel = undefined;
  actionCache.clear();
  fetchedAt = 0;
  stale = true;
  state = { actionsLoading: false };
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The held projects and next actions; refreshed when the screen comes into focus, if needed. */
export function useJobs() {
  const s = useSyncExternalStore(subscribe, () => state);
  useFocusEffect(
    useCallback(() => {
      focused++;
      listen();
      void refreshJobs();
      return () => {
        focused--;
      };
    }, []),
  );
  return { ...s, refresh: () => refreshJobs(true) };
}
