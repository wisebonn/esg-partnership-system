// ---------------------------------------------------------------------------
// EPAS — ESG plan PDF parser (client-side wrapper)
// The heavy parsing happens in /api/parse-plan. This module just types
// the payload and posts the file.
// ---------------------------------------------------------------------------

export type ParsedTask = {
  title: string;
  period: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'N/A';
  assigned_to_name: string; // e.g. "LYDIA ONDITI"
  dependency: string;
  weight: 1 | 2 | 3;
  category: string; // "GOAL TASK" | "API TASK" | ...
  goal_number: number;
  goal_title: string;
};

export type ParsedGoal = {
  number: number;
  title: string;
  targets: string[];
};

export type ParsedPlan = {
  goals: ParsedGoal[];
  tasks: ParsedTask[];
  warnings: string[];
};

export async function extractPlanFromPdf(file: File): Promise<ParsedPlan> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/parse-plan', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let msg = `Parse failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as ParsedPlan;
  return {
    goals: data.goals ?? [],
    tasks: data.tasks ?? [],
    warnings: data.warnings ?? [],
  };
}