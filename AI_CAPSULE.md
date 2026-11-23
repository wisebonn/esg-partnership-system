EPAS — Handoff Capsule v13

Paste everything below into a new chat as the first message.

Davis & Shirtliff (Dayliff) · ESG & Partnerships Dept
Next.js 16.4.2 (App Router, Turbopack, cacheComponents) · React 19.3 · TS 5.9 · Tailwind 4.3 · Supabase · Vercel

Provenance: v13 = v12 plus the 2026-11-02 session (Partner Profitability & Suppliers, Project Sites & Variance, Task Center, Realtime Sync, Audit Evidence & Comments, and Detailed Report Templates). Nothing from this session has been through a full end-to-end user test yet.

§0 — Paths & imports (NEVER VIOLATE)
tsconfig: baseUrl: ".", paths: { "@/*": ["./*"] }, strict, moduleResolution: "bundler", isolatedModules, noEmit.

ts
import { createClient } from "@/app/utils/supabase";
import { 
  PERIODS, TASK_STATUSES, STATUS_COLORS, 
  PROJECT_STATUSES, PROJECT_TYPES, SCORE_PERIODS,
  PROJECT_LIFECYCLE_STEPS, INFRASTRUCTURE_WORKFLOW, GRANT_WORKFLOW,
  PARTNER_CATEGORIES, type ScorePeriod 
} from "@/app/utils/constants";

Inside components: const supabase = createClient();, never a proxy singleton.

§0.5 — NO GUESSWORK (SUPREME RULE)
0.5.1 Verify or ask. Sources of truth, in order: (1) pasted file contents, (2) pasted PowerShell output, (3) pasted Supabase SQL output, (4) pasted tsc / next build output. Anything else: stop and ask with one ready-to-run block.
0.5.2 Must be verified before use: named exports, table columns, DB enum values, shared type shapes, function signatures, tasksToCsv field count, “use client” status, file existence, current contents of any file being replaced, next.config.ts.
0.5.3 Before replacing a working file, the user pastes it in full. Preserve “use client” status, import paths, createClient() inside the component, the existing useEffect dep pattern, select("*") vs explicit columns, use(params) + Suspense, and any legal route config.
0.5.4 Compile checklist: imports resolve; named imports exported; no route-segment config; no top-level await in client files; use(params) only inside Suspense; no SSR new Date(); tasksToCsv fields complete; no unknown columns; .eq/.in types match; useEffect deps are [supabase]/[id]/[fetchTask] or bare + eslint-disable; typed state setters. Any failure: stop and ask.
0.5.5 Full files only. No snippets or ellipses; if truncation looms, say “part 1 of N. Reply ‘continue’.”
0.5.6 Stop shape:
text
STOPPING — need confirmation before writing.
Fact needed: <one line>
Why it blocks me: <one line>
Command to run: <powershell or sql>

§0.6–§0.17 (unchanged rules, condensed)
0.6 [id] / [taskId] are PowerShell wildcards. Always use -LiteralPath.
0.7 Empty output is not success. Capture the exit code.
0.8 Batch fact-gathering into one block.
0.9 tsc green is not done; also run npx next build.
0.10 cacheComponents: true means runtime exports are illegal.
0.11 pdf-parse@2.4.5: no default export; only PDFParse.
0.12 Build diagnostic: npx next build 2>&1 | Select-String -Pattern "Error|error|Failed|failed|✗|✓ Compiled" -Context 2,2.
0.13 Never mix a Supabase response with Promise.resolve({data:null...}) in one Promise.all.
0.14 Scan every className for glued tokens.
0.15 Never overwrite task.weight with step.weight; use t.weight ?? step.weight.
0.16 Greenwashing without N+1: one batched evidence query.
0.17 Working style: batch everything; one reply per turn with facts, commands and deliverable.
0.18 Next.js 16 Blocking Route Error: Never use new Date() in the render cycle or directly inside useMemo. Move it to a useEffect and store it in state.

§1 — What this is
EPAS for Davis & Shirtliff. Users: Lydia Onditi (manager), Esther Akoth (staff), Bonventure Gor (staff).
Key goal: manage partners, follow up on meeting requirements, plan next steps, track progress towards goals, with balanced workload.

§2 — Current state (2026-11-02)
Green by build earlier: proxy.ts, utils/*.ts, layout.tsx, login, dashboard/*.
Shipped this session, ready for testing:
- database: Added 'Supplier' to partner categories. Added project_sites table. Added task_comments table.
- app/utils/useRealtime.ts: Global listener that refreshes the router on DB changes.
- app/components/Charts.tsx: Custom SVG Donut and Bar charts.
- partners/page.tsx: Profitability report (Sales * Contribution% - Cost), Supplier category, Project counts, and Print/PDF template.
- projects/page.tsx: Fixed progress math (counts in-progress), Print/PDF template with Watermark and Image placeholders.
- projects/[id]/page.tsx: Project Sites & Variance table (S-Value, T-Cost, Profit per site).
- plan/page.tsx: Task Center. Preserves AI upload. Adds List/Calendar/Roadmap views, Personal Target dates, Task Type filters.
- audit/page.tsx: "Open & Verify" modal showing actual evidence links and comments. Rejection flow with manager comments.
- dashboard/page.tsx: Added Charts, useRealtimeSync, and Supplier to partner distribution.

§3 — Database schema requirements (Run this if not done)
sql
-- 1. Ensure Supplier category (if using enum)
ALTER TYPE partner_category ADD VALUE IF NOT EXISTS 'Supplier';

-- 2. Create Project Sites
create table if not exists public.project_sites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  location text,
  s_value numeric default 0,
  t_cost numeric default 0,
  created_at timestamptz default now()
);

-- 3. Create Task Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id),
  content text not null,
  created_at timestamptz default now()
);

-- 4. Partner Finance Columns
alter table public.partners
  add column if not exists contract_value numeric default 0,
  add column if not exists sales_value numeric default 0,
  add column if not exists unit_cost numeric default 0;

notify pgrst, 'reload schema';

§4 — Business logic (non-negotiable)
- Profitability Formula: `(Sales Value × Contribution %) − Unit Cost`. Contribution % is a report-time input.
- Task Center: Groups tasks by plan, project, and ad_hoc. Staff can set a "Personal Target" date locally.
- Audit: Managers must open the evidence link/file before approving. Rejections require a comment stored in task_comments.
- Reporting: Project and Partner reports must use the D&S header, "know H2O through experience" tagline, and watermark.
- Automatic Status: 0% = Planning, >0% = Execution, 100% = Completed.
- Project Variance: Total S-Value - Total T-Cost across all sites.

§5 — Next.js 16 constraints
No new Date() directly in Client Components. Set date defaults in useEffect.
cacheComponents: true; no route-segment configs anywhere.
proxy.ts exports async function proxy, never middleware.
Wrapper for dynamic params: use(params) + Suspense.

§6 — File status
File	Status
utils/{supabase,constants,score,excel,aiImport,useRealtime}.ts, proxy.ts, app/layout.tsx, login	✅ keep
components/Charts.tsx	✅ new
dashboard/layout.tsx	✅ updated (realtime sync)
dashboard/page, audit, projects, projects/[id], plan	✅ rewritten, needs test
partners/page.tsx	✅ rewritten, needs test
api/extract-pdf/route.ts	✅ working

§7 — Hard rules
Full files only · RLS stays disabled · createSignedUrl only · no SSR new Date() · no route-segment configs · every form has loading + visible error · score computed on read · design tokens per §1 · §0.5 overrides everything.

§8 — FIRST ACTION for the new AI
Do not write code yet. Ask the user to test:
1. In Partners, add a Partner with a Sales Value and Unit Cost. Open the Report, set Contribution to 50%, and click Print/PDF to check the watermark and header.
2. In Projects, open a project. Add a Site with S-Value and T-Cost to see the Variance table calculate. Click the Report button and check the Image Placeholders.
3. In Task Center (Annual Plan), switch between List, Calendar, and Roadmap. Set a "Personal Target" date.
4. In Audit, click "Open & Verify" on a pending task. Verify the evidence links open, then Reject it with a comment.
5. Check the Dashboard to ensure the Realtime Sync updates the charts instantly.