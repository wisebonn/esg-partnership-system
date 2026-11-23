// ---------------------------------------------------------------------------
// EPAS — zero-dependency CSV builder + download
// Excel opens CSV natively; no external package required.
// ---------------------------------------------------------------------------

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function buildCsv(
  headers: string[],
  rows: CsvCell[][],
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // Client-only. Guard for safety.
  if (typeof window === 'undefined') return;
  // BOM so Excel detects UTF-8
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function tasksToCsv(
  tasks: Array<{
    title: string;
    description: string | null;
    status: string | null;
    period: string | null;
    weight: number | null;
    due_date: string | null;
    assigned_to: string | null;
    project_id: string | null;
    task_type: string | null;
    phase: string | null;
    notes: string | null;
    doc_link: string | null;
    budgeted_cost: number | null;
    actual_cost: number | null;
    variance: number | null;
    recurring: boolean | null;
    zoho_link: string | null;
  }>,
): string {
  const headers = [
    'Title',
    'Description',
    'Status',
    'Period',
    'Weight',
    'Due Date',
    'Assigned To',
    'Project ID',
    'Task Type',
    'Phase',
    'Notes',
    'Doc Link',
    'Budgeted Cost',
    'Actual Cost',
    'Variance',
    'Recurring',
    'Zoho Link',
  ];
  const rows = tasks.map((t) => [
    t.title,
    t.description,
    t.status,
    t.period,
    t.weight,
    t.due_date,
    t.assigned_to,
    t.project_id,
    t.task_type,
    t.phase,
    t.notes,
    t.doc_link,
    t.budgeted_cost,
    t.actual_cost,
    t.variance,
    t.recurring,
    t.zoho_link,
  ]);
  return buildCsv(headers, rows);
}