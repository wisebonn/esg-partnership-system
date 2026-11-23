export type BudgetData = {
  description?: string;
  target_current?: number | string;
  budget_prev?: number | string;
  budget_current?: number | string;
  actual_prev?: number | string;
  actual_current?: number | string;
  unit?: string;
};

export function parseNotes(notes: string | null): BudgetData {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (typeof parsed === "object" && parsed !== null) return parsed as BudgetData;
    return { description: notes };
  } catch {
    return { description: notes };
  }
}

export function stringifyNotes(data: BudgetData): string | null {
  if (!data.description && !data.budget_current && !data.target_current && !data.actual_current) {
    return null;
  }
  return JSON.stringify(data);
}

export function formatMoney(val: number | string | undefined): string {
  if (val === undefined || val === null || val === "") return "—";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(num);
}