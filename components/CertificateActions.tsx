"use client";

import { useState } from "react";
import {
  downloadCertificate,
  shareCertificate,
  type CertificateKind,
} from "@/lib/certificates";

interface CertificateActionsProps {
  userName: string;
  quizTitle: string;
  date: string;
  rank?: number;
  score?: number;
  kindHint?: CertificateKind; // override (admin / forced)
  totalParticipants?: number;
}

const inferKind = (rank: number | undefined, totalParticipants?: number): CertificateKind => {
  if (rank === 1) return "WINNER";
  if (typeof rank === "number" && rank <= 10) return "TOP10";
  return "PARTICIPATION";
};

export const CertificateActions = ({
  userName,
  quizTitle,
  date,
  rank,
  score,
  kindHint,
  totalParticipants,
}: CertificateActionsProps) => {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const kind: CertificateKind = kindHint ?? inferKind(rank, totalParticipants);

  const payload = { kind, userName, quizTitle, date, rank, score };

  const onDownload = () => {
    setBusy("download");
    try {
      downloadCertificate(payload);
    } finally {
      setTimeout(() => setBusy(null), 400);
    }
  };

  const onShare = async () => {
    setBusy("share");
    try {
      await shareCertificate(payload);
    } finally {
      setTimeout(() => setBusy(null), 400);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onDownload}
        disabled={busy !== null}
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10 disabled:opacity-50"
      >
        {busy === "download" ? "..." : "⬇ Certificate"}
      </button>
      <button
        type="button"
        onClick={onShare}
        disabled={busy !== null}
        className="flex-1 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6EE7B7] hover:bg-[#10B981]/20 disabled:opacity-50"
      >
        {busy === "share" ? "..." : "↗ Share"}
      </button>
    </div>
  );
};

export default CertificateActions;
