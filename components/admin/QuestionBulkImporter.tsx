"use client";

import { useRef, useState } from "react";
import {
  buildQuestionsTemplate,
  parseQuestionsFile,
  type ParsedQuestion,
} from "@/lib/parseQuestionsFile";

interface BulkImporterProps {
  onImport: (questions: ParsedQuestion[]) => void;
  mode?: "append" | "replace";
}

export const QuestionBulkImporter = ({ onImport, mode = "append" }: BulkImporterProps) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [summary, setSummary] = useState<{
    accepted: number;
    failed: number;
    total: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSummary(null);
    try {
      const result = await parseQuestionsFile(file);
      setSummary({
        accepted: result.questions.length,
        failed: result.errors.length,
        total: result.totalRows,
        errors: result.errors.slice(0, 6),
      });
      if (result.questions.length > 0) {
        onImport(result.questions);
      }
    } catch (err) {
      console.error("[BulkImport] failed:", err);
      setSummary({
        accepted: 0,
        failed: 1,
        total: 0,
        errors: [
          {
            row: 0,
            reason: err instanceof Error ? err.message : "Unable to read file.",
          },
        ],
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = (format: "csv" | "xlsx") => {
    const blob = buildQuestionsTemplate(format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quizmasters-questions-template.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0B0D19] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white">
          Bulk import questions
        </p>
        <p className="mt-1 text-[11px] text-white/50">
          Upload a CSV or Excel (.xlsx) file. Required columns:{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
            text, optionA, optionB, optionC, optionD, correctAnswer
          </code>
          . Optional:{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
            points, explanation
          </code>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex-1 rounded-xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)] disabled:opacity-50"
        >
          <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B0D19] px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-white hover:bg-[#11142A]">
            {busy ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Parsing…
              </>
            ) : (
              <>↑ Choose file</>
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => downloadTemplate("csv")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
        >
          .csv template
        </button>
        <button
          type="button"
          onClick={() => downloadTemplate("xlsx")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
        >
          .xlsx template
        </button>
      </div>

      {mode === "replace" && (
        <p className="text-[10px] uppercase tracking-wider text-[#FCD34D]">
          ⚠ Importing will replace your current question list.
        </p>
      )}

      {summary && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] ${
            summary.accepted > 0
              ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]"
              : "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]"
          }`}
        >
          <p className="font-bold">
            {summary.accepted} accepted · {summary.failed} skipped · {summary.total} rows total
          </p>
          {summary.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[10px]">
              {summary.errors.map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `Row ${e.row}: ` : ""}{e.reason}
                </li>
              ))}
              {summary.failed > summary.errors.length && (
                <li>…and {summary.failed - summary.errors.length} more.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionBulkImporter;
