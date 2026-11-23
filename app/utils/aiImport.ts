import { PERIODS, type TaskPeriod } from "@/app/utils/constants";

export type ProfileLite = { id: string; full_name: string | null; };

export type AiKeyNumber = { title: string; description?: string; target?: string; };
export type AiGoal = { title: string; description?: string; weight?: 1 | 2 | 3 | null; };
export type AiKpi = { title: string; description?: string; goal_title?: string; };
export type AiTask = { title: string; description?: string; kpi_title?: string; assignee?: string; period?: TaskPeriod | null; due_date?: string | null; weight?: 1 | 2 | 3 | null; };

export type AiPlan = { key_numbers: AiKeyNumber[]; goals: AiGoal[]; kpis: AiKpi[]; tasks: AiTask[]; };

// --- MEETING TYPES ---
export type AiMeetingTask = {
  title: string;
  assignee: string;
  due_date: string | null;
  weight: 1 | 2 | 3;
  notes: string;
};

export type AiMeetingExtract = {
  title: string;
  date: string | null;
  category: string;
  summary: string;
  tasks: AiMeetingTask[];
};

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isValidPeriod = (p: unknown): p is TaskPeriod => typeof p === "string" && (PERIODS as readonly string[]).includes(p);
const asPeriodOrNull = (v: unknown): TaskPeriod | null => (isValidPeriod(v) ? v : null);
const asWeightOrNull = (v: unknown): 1 | 2 | 3 | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r === 1 || r === 2 || r === 3 ? (r as 1 | 2 | 3) : null;
};
const asIsoDateOrNull = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export function buildPlanPrompt(profiles: ProfileLite[]): string {
  const roster = profiles.map((p) => `- ${p.full_name ?? p.id}`).join("\n");
  return `You are an ESG & Partnerships planning parser for Davis & Shirtliff (Dayliff).

Extract the plan from the document below into STRICT JSON with EXACTLY four top-level arrays: "key_numbers", "goals", "kpis", "tasks".

CRITICAL HIERARCHY & PARSING INSTRUCTIONS:
1. KEY NUMBERS: In Section 2 (KEY NUMBERS), extract the 5 main table rows (e.g., REVENUE GENERATED, AMOUNT OF GRANTS, BENEFICIARIES, etc.). The target for 2026 is in the "2026 BUD" column.
2. GOALS: Extract the 4 main Goals (e.g., "LEVERAGE PARTNERSHIPS TO GENERATE REVENUE").
3. KPIs (PERFORMANCE TARGETS): Under each Goal, there is a "PERFORMANCE TARGETS" section. Extract these 1 by 1. You MUST link them to their parent Goal via the "goal_title" field.
4. TASKS: Extract the rows from the task tables. Each Task MUST link to its parent Performance Target (KPI) via the "kpi_title" field. If a task doesn't explicitly name a KPI, link it to the first KPI under the same Goal.
5. WEIGHTS: Tasks in the table have weights (1, 2, or 3). Activity plan weights (10, 15, 30) should be mapped to 3 (high), 2 (medium), or 1 (low).
6. PERIODS: Use Q1, Q2, Q3, Q4, or N/A.

Output shape:
{
  "key_numbers": [ { "title": "", "target": "" } ],
  "goals": [ { "title": "", "weight": null } ],
  "kpis": [ { "title": "", "goal_title": "" } ],
  "tasks": [ { "title": "", "kpi_title": "", "assignee": "", "period": "", "weight": 1 } ]
}

Roster:
${roster || "(none)"}

DOCUMENT:
"""
[INSERT DOCUMENT TEXT HERE]
"""
Return JSON now.`;
}

export function parseAiJson(raw: string): AiPlan {
  let text = (raw ?? "").trim();
  if (text.startsWith("\`\`\`")) text = text.replace(/^\`\`\`[a-zA-Z]*\s*/, "").replace(/\`\`\`\s*$/, "").trim();
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON object found.");
  
  let obj: any;
  try { obj = JSON.parse(text.slice(first, last + 1)); } 
  catch (e: any) { throw new Error(`JSON parse failed: ${e.message}`); }
  
  const rawKeys = Array.isArray(obj.key_numbers) ? obj.key_numbers : [];
  const rawGoals = Array.isArray(obj.goals) ? obj.goals : [];
  const rawKpis = Array.isArray(obj.kpis) ? obj.kpis : [];
  const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];

  const seenKeys = new Set<string>();
  const key_numbers: AiKeyNumber[] = [];
  for (const r of rawKeys) {
    const title = asString(r.title); if (!title || seenKeys.has(norm(title))) continue;
    seenKeys.add(norm(title));
    key_numbers.push({ title, description: asString(r.description) || undefined, target: asString(r.target) || undefined });
  }

  const seenGoals = new Set<string>();
  const goals: AiGoal[] = [];
  for (const r of rawGoals) {
    const title = asString(r.title); if (!title || seenGoals.has(norm(title))) continue;
    seenGoals.add(norm(title));
    goals.push({ title, description: asString(r.description) || undefined, weight: asWeightOrNull(r.weight) });
  }

  const seenKpis = new Set<string>();
  const kpis: AiKpi[] = [];
  for (const r of rawKpis) {
    const title = asString(r.title); if (!title || seenKpis.has(norm(title))) continue;
    seenKpis.add(norm(title));
    const goalTitle = asString(r.goal_title);
    kpis.push({ title, description: asString(r.description) || undefined, goal_title: goalTitle && seenGoals.has(norm(goalTitle)) ? goalTitle : undefined });
  }

  const seenTasks = new Set<string>();
  const tasks: AiTask[] = [];
  for (const r of rawTasks) {
    const title = asString(r.title); if (!title || seenTasks.has(norm(title))) continue;
    seenTasks.add(norm(title));
    const kpiTitle = asString(r.kpi_title);
    tasks.push({ title, description: asString(r.description) || undefined, kpi_title: kpiTitle && seenKpis.has(norm(kpiTitle)) ? kpiTitle : undefined, assignee: asString(r.assignee) || undefined, period: asPeriodOrNull(r.period), due_date: asIsoDateOrNull(r.due_date), weight: asWeightOrNull(r.weight) });
  }

  return { key_numbers, goals, kpis, tasks };
}

export function matchMemberId(name: string, profiles: ProfileLite[]): string {
  const n = norm(name); if (!n) return "";
  const tokens = n.split(" ").filter(Boolean);
  const scored = profiles.map(p => {
    let score = 0; const hay = norm(p.full_name ?? "");
    for (const t of tokens) if (hay.includes(t)) score++;
    return { id: p.id, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return "";
  return scored.filter(s => s.score === scored[0].score).length === 1 ? scored[0].id : "";
}

// --- MEETING PROMPT & PARSER ---

export function buildMeetingPrompt(team: string[]): string {
  return `You are helping an ESG team log meeting minutes and extract action items.

Team members (the only valid assignees):
${team.map((n) => "- " + n).join("\n")}

Rules:
1. Read the attached meeting notes.
2. Extract the meeting "title", "date" (YYYY-MM-DD), and a short "summary" (max 5 lines).
3. Categorize the meeting into exactly one of these tags: "Partner Meeting", "Project Meeting", or "Internal Sync".
4. Extract EVERY action item (task). For each task:
   - "assignee" must be one of the team names above, or empty if unclear.
   - "due_date" must be YYYY-MM-DD or empty.
   - "weight" is 1, 2, or 3 (3 is critical).
   - "notes" is a short context line.

Reply with ONE JSON object only. No markdown.
JSON shape:
{
  "title": "Meeting Title",
  "date": "YYYY-MM-DD",
  "category": "Project Meeting",
  "summary": "Short summary...",
  "tasks": [
    {"title": "Action item", "assignee": "", "due_date": "", "weight": 2, "notes": ""}
  ]
}`;
}

export function parseMeetingJson(raw: string): AiMeetingExtract {
  let text = (raw ?? "").trim();
  if (text.startsWith("\`\`\`")) text = text.replace(/^\`\`\`[a-zA-Z]*\s*/, "").replace(/\`\`\`\s*$/, "").trim();
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON object found.");
  
  let obj: any;
  try { obj = JSON.parse(text.slice(first, last + 1)); } 
  catch (e: any) { throw new Error(`JSON parse failed: ${e.message}`); }

  const title = asString(obj.title) || "Untitled Meeting";
  const date = asIsoDateOrNull(obj.date);
  const category = ["Partner Meeting", "Project Meeting", "Internal Sync"].includes(asString(obj.category)) 
    ? asString(obj.category) 
    : "Internal Sync";
  const summary = asString(obj.summary);

  const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];
  const tasks: AiMeetingTask[] = [];
  
  for (const r of rawTasks) {
    const taskTitle = asString(r.title);
    if (!taskTitle) continue;
    tasks.push({
      title: taskTitle,
      assignee: asString(r.assignee),
      due_date: asIsoDateOrNull(r.due_date),
      weight: asWeightOrNull(r.weight) || 2,
      notes: asString(r.notes),
    });
  }

  return { title, date, category, summary, tasks };
}