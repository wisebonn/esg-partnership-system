import { NextRequest, NextResponse } from "next/server";
import type { ParsedGoal, ParsedPlan, ParsedTask } from "@/app/utils/pdf";
import { PDFParse } from "pdf-parse";

const PERIOD_RE = /\bQ[1-4]\b/g;
const WEIGHT_RE = /\b([1-3])\b/;
const KNOWN_PEOPLE = ["LYDIA ONDITI", "BONVENTURE GOR", "ESTHER AKOTH"] as const;

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function detectPerson(line: string): string {
  const upper = line.toUpperCase();
  for (const p of KNOWN_PEOPLE) if (upper.includes(p)) return p;
  const m = line.match(/\b([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,2})\b/);
  return m ? m[1] : "";
}

function detectPeriods(line: string): Array<"Q1" | "Q2" | "Q3" | "Q4" | "N/A"> {
  const matches = line.toUpperCase().match(PERIOD_RE);
  if (!matches || matches.length === 0) return ["N/A"];
  const uniq = Array.from(new Set(matches)) as Array<"Q1" | "Q2" | "Q3" | "Q4">;
  return uniq;
}

function detectWeight(line: string): 1 | 2 | 3 {
  const labelled = line.match(/weight\s*[:\-]?\s*([1-3])/i);
  if (labelled) return Number(labelled[1]) as 1 | 2 | 3;
  const m = line.match(WEIGHT_RE);
  if (m) return Number(m[1]) as 1 | 2 | 3;
  return 2;
}

function detectCategory(line: string): string {
  const upper = line.toUpperCase();
  if (upper.includes("GOAL TASK")) return "GOAL TASK";
  if (upper.includes("API TASK")) return "API TASK";
  if (upper.includes("M&E")) return "M&E TASK";
  if (upper.includes("REPORT")) return "REPORT TASK";
  return "TASK";
}

function detectDependency(line: string): string {
  const m = line.match(/dep(?:endency)?\s*[:\-]\s*([^|;\n]+)/i);
  return m ? cleanLine(m[1]) : "";
}

function extractGoals(text: string): ParsedGoal[] {
  const goals: ParsedGoal[] = [];
  const goalHeaderRe = /GOAL\s+(\d+)\s*[:\-]?\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = goalHeaderRe.exec(text)) !== null) {
    goals.push({
      number: Number(m[1]),
      title: cleanLine(m[2]).slice(0, 200),
      targets: [],
    });
  }
  return goals;
}

function splitRows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 10);
}

function parseTaskLine(
  line: string,
  goalNumber: number,
  goalTitle: string
): ParsedTask | null {
  const upper = line.toUpperCase();
  if (upper.startsWith("TASK DESCRIPTION")) return null;
  if (upper === "PERIOD" || upper === "WEIGHT") return null;
  if (/^PAGE\s+\d+/i.test(line)) return null;
  // pdf-parse page separators such as "-- 1 of 3 --" (defensive, unverified)
  if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line)) return null;

  const periods = detectPeriods(line);
  const weight = detectWeight(line);
  const person = detectPerson(line);
  const dependency = detectDependency(line);
  const category = detectCategory(line);

  let title = line;
  for (const p of KNOWN_PEOPLE) title = title.replace(new RegExp(p, "gi"), "");
  title = title.replace(PERIOD_RE, "");
  title = title.replace(/dep(?:endency)?\s*[:\-]\s*[^|;\n]+/i, "");
  title = cleanLine(title)
    .replace(/^[|;\-\s]+/, "")
    .replace(/[|;\-\s]+$/, "");
  if (title.length < 4) return null;

  return {
    title: title.slice(0, 300),
    period: periods[0],
    assigned_to_name: person,
    dependency,
    weight,
    category,
    goal_number: goalNumber,
    goal_title: goalTitle,
  };
}

function extractTasks(text: string, goals: ParsedGoal[]): ParsedTask[] {
  const out: ParsedTask[] = [];
  const lines = splitRows(text);
  let currentGoalNumber = 0;
  let currentGoalTitle = "";

  for (const line of lines) {
    const goalMatch = line.match(/^GOAL\s+(\d+)\s*[:\-]?\s*(.*)$/i);
    if (goalMatch) {
      currentGoalNumber = Number(goalMatch[1]);
      currentGoalTitle = cleanLine(goalMatch[2]).slice(0, 200);
      continue;
    }
    const parsed = parseTaskLine(line, currentGoalNumber, currentGoalTitle);
    if (!parsed) continue;

    const periods = detectPeriods(line);
    if (periods.length > 1 && periods[0] !== "N/A") {
      for (const p of periods) out.push({ ...parsed, period: p });
    } else {
      out.push(parsed);
    }
  }

  if (out.length > 0 && goals.length === 0) {
    goals.push({ number: 0, title: "Uncategorised", targets: [] });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: 'No file uploaded. Expected multipart field "file".' },
        { status: 400 }
      );
    }

    const arrayBuf = await (file as File).arrayBuffer();
    if (arrayBuf.byteLength === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    let rawText = "";
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: new Uint8Array(arrayBuf) });
      const result = await parser.getText();
      rawText = result.text ?? "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "PDF text extraction failed: " + msg },
        { status: 422 }
      );
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          /* ignore cleanup errors */
        }
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          error:
            "PDF contained no extractable text. It may be a scanned image — OCR is not supported.",
        },
        { status: 422 }
      );
    }

    const warnings: string[] = [];
    const goals = extractGoals(rawText);
    const tasks = extractTasks(rawText, goals);

    if (goals.length === 0) warnings.push("No GOAL headers detected in PDF.");
    if (tasks.length === 0) {
      warnings.push(
        "No task rows detected. The PDF may use a layout the parser does not recognise."
      );
    }
    const missingPeople = tasks.filter((t) => !t.assigned_to_name).length;
    if (missingPeople > 0) {
      warnings.push(
        `${missingPeople} task(s) have no recognised assignee — assign them during review.`
      );
    }

    const payload: ParsedPlan = { goals, tasks, warnings };
    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unexpected error: " + msg }, { status: 500 });
  }
}