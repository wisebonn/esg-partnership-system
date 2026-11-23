// ---------------------------------------------------------------------------
// EPAS — scoring & analytics helpers
// ---------------------------------------------------------------------------

import type { ScorePeriod } from "./constants";

export type TaskLite = {
  id: string;
  title: string;
  status: string | null;
  weight: number | null;
  period: string | null;
  due_date: string | null;
  assigned_to: string | null;
  project_id: string | null;
  task_type: string | null;
  greenwash_overridden?: boolean | null; // NEW FIELD
};

export type EvidenceLite = {
  id: string;
  task_id: string;
  verified_by_manager: boolean | null;
};

export function isOverdue(task: Pick<TaskLite, "due_date" | "status">): boolean {
  if (!task.due_date) return false;
  if (task.status === "Verified") return false;
  
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  
  return due < d;
}

export function isDueSoon(
  task: Pick<TaskLite, "due_date" | "status">,
  withinDays = 7
): boolean {
  if (!task.due_date) return false;
  if (task.status === "Verified") return false;
  
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  
  const diffMs = due.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= withinDays;
}

export function taskCompletion(
  task: Pick<TaskLite, "status">,
  hasVerifiedEvidence: boolean
): 0 | 50 | 100 {
  if (task.status === "Verified" && hasVerifiedEvidence) return 100;
  if (task.status === "To Do") return 0;
  return 50;
}

export function isGreenwashing(
  task: Pick<TaskLite, "status" | "greenwash_overridden">,
  hasVerifiedEvidence: boolean
): boolean {
  // If the manager explicitly overrode the greenwash flag, it is NO LONGER greenwashing
  if (task.greenwash_overridden === true) return false;
  
  return task.status === "Verified" && !hasVerifiedEvidence;
}

export type ScoreResult = {
  score: number;
  totalWeight: number;
  verifiedWeight: number;
  taskCount: number;
  verifiedCount: number;
  greenwashedCount: number;
};

export function weightedScore(
  tasks: TaskLite[],
  evidenceByTaskId: Record<string, EvidenceLite[]>,
  filter?: (task: TaskLite) => boolean
): ScoreResult {
  const scoped = filter ? tasks.filter(filter) : tasks;
  let totalWeight = 0;
  let verifiedWeight = 0;
  let verifiedCount = 0;
  let greenwashedCount = 0;

  for (const t of scoped) {
    const w = t.weight ?? 1;
    totalWeight += w;

    const evidence = evidenceByTaskId[t.id] ?? [];
    const hasVerified = evidence.some((e) => e.verified_by_manager === true);
    const isOverridden = t.greenwash_overridden === true;

    // If overridden, we treat it as verified for scoring purposes
    if ((t.status === "Verified" && hasVerified) || isOverridden) {
      verifiedWeight += w;
      verifiedCount += 1;
    } else if (t.status === "Verified" && !hasVerified) {
      greenwashedCount += 1;
    }
  }

  const score = totalWeight === 0 ? 0 : (verifiedWeight / totalWeight) * 100;

  return {
    score: Math.round(score * 10) / 10,
    totalWeight,
    verifiedWeight,
    taskCount: scoped.length,
    verifiedCount,
    greenwashedCount,
  };
}

export function individualScore(
  tasks: TaskLite[],
  evidenceByTaskId: Record<string, EvidenceLite[]>,
  userId: string
): ScoreResult {
  return weightedScore(tasks, evidenceByTaskId, (t) => t.assigned_to === userId);
}

export function periodPredicate(
  period: ScorePeriod
): (task: Pick<TaskLite, "period">) => boolean {
  if (period === "All") return () => true;
  if (period === "YTD") {
    return (t) => t.period !== "N/A";
  }
  return (t) => t.period === period;
}

export function pendingVerificationCount(
  tasks: TaskLite[],
  evidenceByTaskId: Record<string, EvidenceLite[]>
): number {
  let n = 0;
  for (const t of tasks) {
    if (t.status !== "Pending Evidence") continue;
    const evidence = evidenceByTaskId[t.id] ?? [];
    const anyUnverified = evidence.some((e) => e.verified_by_manager !== true);
    if (anyUnverified) n += 1;
  }
  return n;
}