// ---------------------------------------------------------------------------
// EPAS — shared constants
// ---------------------------------------------------------------------------

export const TASK_TYPES = ['plan', 'project', 'ad_hoc'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  plan: 'ESG Plan',
  project: 'Project',
  ad_hoc: 'Ad-hoc',
};

export const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'N/A'] as const;
export type TaskPeriod = (typeof PERIODS)[number];

export const SCORE_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'YTD', 'All'] as const;
export type ScorePeriod = (typeof SCORE_PERIODS)[number];

export const TASK_STATUSES = [
  'To Do',
  'In Progress',
  'Pending Evidence',
  'Verified',
  'Blocked',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-slate-700/50 text-slate-300 border-slate-600',
  'In Progress': 'bg-blue-600/20 text-blue-300 border-blue-500/40',
  'Pending Evidence': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Blocked: 'bg-red-600/20 text-red-300 border-red-500/40',
};

export const PARTNER_CATEGORIES = [
  'Corporate',
  'Non-Governmental (NGO)',
  'Philanthropic',
  'Governmental',
  'Humanitarian / Multilateral',
  'Supplier', // Added Supplier category
] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

// Legacy alias so any existing `import { PARTNER_TYPES }` keeps compiling.
// Points at the new category list; remove once all callers migrate to PARTNER_CATEGORIES.
export const PARTNER_TYPES = PARTNER_CATEGORIES;
export type PartnerType = PartnerCategory;

export const PROJECT_STATUSES = [
  'Inception',
  'Planning',
  'Execution',
  'Monitoring & Control',
  'Closure',
  'Completed',
  'On Hold',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = [
  'CSR Partnership',
  'ESG Initiative',
  'Donation',
  'Sponsorship',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Industry Workflows (Module 2)
// ---------------------------------------------------------------------------

export type WorkflowStep = {
  key: string;
  label: string;
  weight: 1 | 2 | 3;
  phase: string;
  requires: string; // The specific evidence required
};

export const INFRASTRUCTURE_WORKFLOW: WorkflowStep[] = [
  {
    key: 'infra_site',
    label: 'Technical Site Assessment',
    weight: 2,
    phase: 'Engineering & Deployment',
    requires: 'Site Survey Document, Geotagged Photos',
  },
  {
    key: 'infra_design',
    label: 'Engineering Designs & BOQ',
    weight: 2,
    phase: 'Engineering & Deployment',
    requires: 'CAD/Single-Line Diagrams, Final BOQ Spreadsheet',
  },
  {
    key: 'infra_procure',
    label: 'Procurement Logistics',
    weight: 1,
    phase: 'Engineering & Deployment',
    requires: 'Supplier Purchase Orders, Bill of Lading/Delivery Note',
  },
  {
    key: 'infra_install',
    label: 'Physical Installation',
    weight: 3,
    phase: 'Engineering & Deployment',
    requires: '"As-Built" Photos or regular field comment updates',
  },
  {
    key: 'infra_handover',
    label: 'Commissioning & Handover',
    weight: 2,
    phase: 'Engineering & Deployment',
    requires: 'Signed Commissioning Checklist, Signed Handover Certificate',
  },
  {
    key: 'finance_recon',
    label: 'Continuous Project Financial Reconciliation',
    weight: 2,
    phase: 'Financing & Field Operations',
    requires: 'Comprehensive Financial Reconciliation Report matching expenditures to budget lines, expense ledgers, and Donor Reimbursement Vouchers',
  },
];

export const GRANT_WORKFLOW: WorkflowStep[] = [
  {
    key: 'grant_upfront',
    label: 'Upfront Funds Allocation',
    weight: 1,
    phase: 'Grant Lifecycle',
    requires: 'Signed Grant Agreement, Disbursement Wire Receipt, Approved Budget',
  },
  {
    key: 'grant_milestone',
    label: 'Milestone-based Activity Tracking',
    weight: 3,
    phase: 'Grant Lifecycle',
    requires: 'Technical Milestone Reports, Proof of Delivery, Expense Invoices',
  },
  {
    key: 'grant_impact',
    label: 'Grant Impact Reporting',
    weight: 2,
    phase: 'Grant Lifecycle',
    requires: 'Final Impact Narrative or a closure comment',
  },
  {
    key: 'finance_pre',
    label: 'Pre-financing Account Setup',
    weight: 2,
    phase: 'Financing & Field Operations',
    requires: 'Bank Account Confirmation, Ledger Chart of Accounts',
  },
  {
    key: 'finance_field',
    label: 'Bi-weekly Field Data Aggregation Framework',
    weight: 3,
    phase: 'Financing & Field Operations',
    requires: 'Standardized Collection Template, Active Bi-weekly Log',
  },
  {
    key: 'finance_recon',
    label: 'Continuous Project Financial Reconciliation',
    weight: 2,
    phase: 'Financing & Field Operations',
    requires: 'Comprehensive Financial Reconciliation Report matching expenditures to budget lines, expense ledgers, and Donor Reimbursement Vouchers',
  },
];

// ---------------------------------------------------------------------------
// Legacy 13-step lifecycle (Kept for backward compatibility)
// ---------------------------------------------------------------------------

export type LifecycleStep = {
  key: string;
  label: string;
  weight: 1 | 2 | 3;
  phase: string;
};

export const PROJECT_LIFECYCLE_STEPS: LifecycleStep[] = [
  { key: 'init_mou', label: 'MOU & CSR Agreement Signed', weight: 3, phase: 'Initiation' },
  { key: 'plan_beneficiaries', label: 'Prospect Beneficiaries', weight: 2, phase: 'Planning' },
  { key: 'plan_bc_job', label: 'BC Job Creation', weight: 2, phase: 'Planning' },
  { key: 'plan_invoice_po', label: '2-line Invoice + PO', weight: 3, phase: 'Planning' },
  { key: 'plan_workbook', label: 'Work Plan / Workbook', weight: 2, phase: 'Planning' },
  { key: 'exec_site_visit', label: 'Site Visit', weight: 2, phase: 'Execution' },
  { key: 'exec_mobilization', label: 'Mobilization', weight: 2, phase: 'Execution' },
  { key: 'exec_installation', label: 'Installation', weight: 3, phase: 'Execution' },
  { key: 'exec_testing', label: 'Testing & Commissioning', weight: 3, phase: 'Execution' },
  { key: 'exec_training', label: 'Training', weight: 2, phase: 'Execution' },
  { key: 'mc_reconciliation', label: 'Financial Reconciliation & Revenue Sharing', weight: 3, phase: 'Monitoring & Control' },
  { key: 'close_handover', label: 'Official Handover & Consent Forms', weight: 3, phase: 'Closure' },
  { key: 'close_me_call', label: '3-Month M&E Call', weight: 3, phase: 'Closure' },
];

export const LIFECYCLE_PHASES = [
  'Initiation',
  'Planning',
  'Execution',
  'Monitoring & Control',
  'Closure',
] as const;

export const VERIFICATION_OVERFLOW_THRESHOLD = 5;

export const EVIDENCE_BUCKET = 'evidence';
export const SIGNED_URL_TTL_SECONDS = 3600;