import * as XLSX from "xlsx";

export type OptionKey = "A" | "B" | "C" | "D";

export interface ParsedQuestion {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: OptionKey;
  points: number;
  explanation: string;
}

export interface ParsedQuestionsResult {
  questions: ParsedQuestion[];
  errors: { row: number; reason: string }[];
  totalRows: number;
}

/**
 * Accepted header aliases (case-insensitive, trimmed).
 */
const HEADERS: Record<string, keyof ParsedQuestion | "_skip"> = {
  text: "text",
  question: "text",
  "question text": "text",
  q: "text",

  optiona: "optionA",
  "option a": "optionA",
  a: "optionA",

  optionb: "optionB",
  "option b": "optionB",
  b: "optionB",

  optionc: "optionC",
  "option c": "optionC",
  c: "optionC",

  optiond: "optionD",
  "option d": "optionD",
  d: "optionD",

  correctanswer: "correctAnswer",
  "correct answer": "correctAnswer",
  correct: "correctAnswer",
  answer: "correctAnswer",

  points: "points",
  marks: "points",
  score: "points",

  explanation: "explanation",
  reason: "explanation",
  hint: "explanation",
};

const ALLOWED: OptionKey[] = ["A", "B", "C", "D"];

const normalizeHeader = (h: string): string =>
  h.toString().trim().toLowerCase().replace(/[_-]+/g, " ");

const toCleanString = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
};

const toOptionKey = (v: unknown): OptionKey | null => {
  const s = toCleanString(v).toUpperCase();
  if (s.length === 0) return null;
  // Accept "A", "a", "Option A", "1" (=> A), etc.
  if (ALLOWED.includes(s as OptionKey)) return s as OptionKey;
  const last = s.charAt(s.length - 1);
  if (ALLOWED.includes(last as OptionKey)) return last as OptionKey;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return ALLOWED[n - 1];
  return null;
};

const toPoints = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.trunc(n)));
};

/**
 * Parse a CSV or XLSX file (or any sheet-like format that xlsx supports)
 * into a structured ParsedQuestionsResult.
 */
export const parseQuestionsFile = async (
  file: File
): Promise<ParsedQuestionsResult> => {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { questions: [], errors: [{ row: 0, reason: "No sheet found in file." }], totalRows: 0 };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { questions: [], errors: [{ row: 0, reason: "Sheet is empty." }], totalRows: 0 };
  }

  // Build column → field map using the first row's keys
  const rawHeaders = Object.keys(rows[0]);
  const headerMap: Record<string, keyof ParsedQuestion> = {};
  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw);
    const field = HEADERS[norm];
    if (field && field !== "_skip") {
      headerMap[raw] = field;
    }
  }

  // Validate required headers exist
  const requiredFields: (keyof ParsedQuestion)[] = [
    "text",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
  ];
  const mappedFields = new Set(Object.values(headerMap));
  const missing = requiredFields.filter((f) => !mappedFields.has(f));
  if (missing.length > 0) {
    return {
      questions: [],
      errors: [
        {
          row: 0,
          reason: `Missing required columns: ${missing.join(", ")}. Use the downloadable template.`,
        },
      ],
      totalRows: rows.length,
    };
  }

  const questions: ParsedQuestion[] = [];
  const errors: { row: number; reason: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // human-friendly: header is row 1
    const partial: Partial<ParsedQuestion> = {};

    for (const [rawHeader, field] of Object.entries(headerMap)) {
      const value = row[rawHeader];
      if (field === "correctAnswer") {
        const ok = toOptionKey(value);
        if (ok) partial.correctAnswer = ok;
      } else if (field === "points") {
        partial.points = toPoints(value);
      } else {
        (partial as Record<string, string>)[field] = toCleanString(value);
      }
    }

    // Validate this row
    const missingFields: string[] = [];
    if (!partial.text) missingFields.push("text");
    if (!partial.optionA) missingFields.push("optionA");
    if (!partial.optionB) missingFields.push("optionB");
    if (!partial.optionC) missingFields.push("optionC");
    if (!partial.optionD) missingFields.push("optionD");
    if (!partial.correctAnswer) missingFields.push("correctAnswer");

    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        reason: `Missing/invalid: ${missingFields.join(", ")}`,
      });
      return;
    }

    questions.push({
      text: partial.text as string,
      optionA: partial.optionA as string,
      optionB: partial.optionB as string,
      optionC: partial.optionC as string,
      optionD: partial.optionD as string,
      correctAnswer: partial.correctAnswer as OptionKey,
      points: partial.points ?? 1,
      explanation: partial.explanation ?? "",
    });
  });

  return { questions, errors, totalRows: rows.length };
};

/**
 * Build the downloadable template (with one example row) as a Blob.
 */
export const buildQuestionsTemplate = (format: "csv" | "xlsx" = "csv"): Blob => {
  const header = [
    "text",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "points",
    "explanation",
  ];
  const example = [
    "Which Indian city is known as the Silicon Valley of India?",
    "Mumbai",
    "Bengaluru",
    "Hyderabad",
    "Pune",
    "B",
    "1",
    "Bengaluru is widely considered the tech hub of India.",
  ];
  const example2 = [
    "Who wrote the Indian national anthem 'Jana Gana Mana'?",
    "Bankim Chandra Chatterjee",
    "Sarojini Naidu",
    "Rabindranath Tagore",
    "Subramania Bharati",
    "C",
    "1",
    "Composed by Rabindranath Tagore in 1911.",
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, example, example2]);

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  const csv = XLSX.utils.sheet_to_csv(ws);
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
};
