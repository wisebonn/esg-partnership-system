import { type TaskPeriod } from "@/app/utils/constants";

export type DistributeTask = {
  id: string;
  title: string;
  period: TaskPeriod | null;
  due_date: string | null;
  assigned_to: string | null;
  weight: number | null;
  status?: string | null;
  notes?: string | null;
};
export type DistributeUpdate = { id: string; due_date: string; period: TaskPeriod };
export type NeedsTimelineItem = { id: string; title: string; assigned_to: string | null };
export type DistributeResult = { updates: DistributeUpdate[]; needsTimeline: NeedsTimelineItem[] };

const REVIEW_WINDOW_DAYS = 14;
const PLAN_YEAR = 2027; // FY 2026/27 anchor. Q1 = Dec 2026 – Feb 2027.

// 0-indexed months. Q1 wraps Dec→Feb; quarterWindow handles the year shift.
const QUARTER_MONTHS: Record<"Q1" | "Q2" | "Q3" | "Q4", [number, number]> = {
  Q1: [11, 1],
  Q2: [2, 4],
  Q3: [5, 7],
  Q4: [8, 10],
};

const isQuarter = (p: TaskPeriod | null): p is "Q1" | "Q2" | "Q3" | "Q4" =>
  p === "Q1" || p === "Q2" || p === "Q3" || p === "Q4";

const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseIso = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : atMidnight(d);
};

const workingDaysBetween = (start: Date, end: Date): Date[] => {
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const quarterWindow = (q: "Q1" | "Q2" | "Q3" | "Q4") => {
  const [sm, em] = QUARTER_MONTHS[q];
  // Q1 of PLAN_YEAR spans Dec(PLAN_YEAR-1) → Feb(PLAN_YEAR).
  const startYear = q === "Q1" ? PLAN_YEAR - 1 : PLAN_YEAR;
  const endYear = PLAN_YEAR;
  const start = new Date(startYear, sm, 1);
  const end = new Date(endYear, em + 1, 1);
  const reviewStart = new Date(end);
  reviewStart.setDate(reviewStart.getDate() - REVIEW_WINDOW_DAYS);
  return { start, end, reviewStart };
};

const isLocked = (t: DistributeTask) => (t.notes ?? "").includes("[LOCKED]");
const isVerified = (t: DistributeTask) => t.status === "Verified";

// Assign tasks to slots with per-tier even stride so weight tiers interleave
// across the whole quarter rather than clustering at the front.
function assignWithInterleave(list: DistributeTask[], slotCount: number): Map<string, number> {
  const result = new Map<string, number>();
  if (slotCount === 0) return result;

  const tiers: Record<1 | 2 | 3, DistributeTask[]> = { 1: [], 2: [], 3: [] };
  for (const t of list) {
    const w = t.weight === 1 || t.weight === 2 || t.weight === 3 ? t.weight : 2;
    tiers[w].push(t);
  }
  // Stable secondary sort: alphabetical, so re-runs are deterministic.
  for (const k of [1, 2, 3] as const) tiers[k].sort((a, z) => a.title.localeCompare(z.title));

  const used = new Set<number>();
  const nextFree = (from: number): number => {
    for (let i = from; i < slotCount; i++) if (!used.has(i)) return i;
    for (let i = 0; i < from; i++) if (!used.has(i)) return i;
    return from; // fully saturated — allow sharing
  };

  // Heaviest tier claims its stride first; lighter tiers fill the gaps.
  for (const w of [3, 2, 1] as const) {
    const tier = tiers[w];
    if (tier.length === 0) continue;
    const step = tier.length > 1 ? (slotCount - 1) / (tier.length - 1) : 0;
    tier.forEach((t, i) => {
      const ideal = tier.length > 1 ? Math.round(i * step) : Math.floor(slotCount / 2);
      const idx = nextFree(ideal);
      used.add(idx);
      result.set(t.id, idx);
    });
  }
  return result;
}

export function calculateSmartDistribution(
  tasks: DistributeTask[],
  scope: TaskPeriod | "all",
): DistributeResult {
  const updates: DistributeUpdate[] = [];
  const needsTimeline: NeedsTimelineItem[] = [];

  type Bucket = { q: "Q1" | "Q2" | "Q3" | "Q4"; list: DistributeTask[] };
  const buckets = new Map<string, Bucket>();

  for (const t of tasks) {
    // Skip only verified or explicitly locked tasks. Everything else is eligible
    // for re-spread on every run.
    if (isVerified(t) || isLocked(t)) continue;

    if (isQuarter(t.period)) {
      // Honor scope filter.
      if (scope !== "all" && isQuarter(scope) && scope !== t.period) continue;
      const b = buckets.get(t.period) ?? { q: t.period, list: [] };
      b.list.push(t);
      buckets.set(t.period, b);
      continue;
    }

    // Non-quarter tasks: preserve existing date if present, else queue for timeline.
    const parsed = parseIso(t.due_date);
    if (parsed) {
      updates.push({ id: t.id, due_date: toIso(parsed), period: "Q1" });
    } else {
      needsTimeline.push({ id: t.id, title: t.title, assigned_to: t.assigned_to });
    }
  }

  for (const b of buckets.values()) {
    const { start, reviewStart } = quarterWindow(b.q);
    const slots = workingDaysBetween(start, reviewStart);

    if (slots.length === 0) {
      for (const t of b.list) {
        needsTimeline.push({ id: t.id, title: t.title, assigned_to: t.assigned_to });
      }
      continue;
    }

    const assignment = assignWithInterleave(b.list, slots.length);
    for (const t of b.list) {
      const idx = assignment.get(t.id);
      if (idx === undefined) continue;
      updates.push({ id: t.id, due_date: toIso(slots[idx]), period: b.q });
    }
  }

  return { updates, needsTimeline };
}