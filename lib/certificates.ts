"use client";

import jsPDF from "jspdf";

export type CertificateKind = "WINNER" | "TOP10" | "PARTICIPATION";

export interface CertificatePayload {
  kind: CertificateKind;
  userName: string;
  quizTitle: string;
  date: string; // human-readable
  rank?: number;
  score?: number;
}

const kindMeta: Record<CertificateKind, { title: string; subtitle: string; color: [number, number, number] }> = {
  WINNER: {
    title: "Certificate of Victory",
    subtitle: "is hereby crowned the Champion of",
    color: [245, 158, 11],
  },
  TOP10: {
    title: "Top 10 Certificate",
    subtitle: "is among the top performers of",
    color: [37, 99, 235],
  },
  PARTICIPATION: {
    title: "Certificate of Participation",
    subtitle: "has successfully participated in",
    color: [16, 185, 129],
  },
};

export const generateCertificate = (data: CertificatePayload): jsPDF => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const meta = kindMeta[data.kind];

  // Background
  doc.setFillColor(11, 13, 25);
  doc.rect(0, 0, w, h, "F");

  // Decorative double border
  doc.setDrawColor(meta.color[0], meta.color[1], meta.color[2]);
  doc.setLineWidth(3);
  doc.rect(24, 24, w - 48, h - 48);
  doc.setLineWidth(0.8);
  doc.rect(34, 34, w - 68, h - 68);

  // Brand band
  doc.setFillColor(meta.color[0], meta.color[1], meta.color[2]);
  doc.rect(0, 0, w, 8, "F");
  doc.rect(0, h - 8, w, 8, "F");

  // Header brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("QuizMasters India", w / 2, 80, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 220);
  doc.text("LEARN · COMPETE · WIN", w / 2, 100, { align: "center" });

  // Title
  doc.setTextColor(meta.color[0], meta.color[1], meta.color[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(meta.title, w / 2, 170, { align: "center" });

  // Awarded line
  doc.setTextColor(220, 220, 235);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("This certificate is proudly presented to", w / 2, 215, { align: "center" });

  // User name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text(data.userName, w / 2, 270, { align: "center" });

  // Subtitle + quiz title
  doc.setTextColor(220, 220, 235);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.text(meta.subtitle, w / 2, 305, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(meta.color[0], meta.color[1], meta.color[2]);
  doc.text(data.quizTitle, w / 2, 335, { align: "center" });

  // Optional rank / score
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(180, 180, 200);
  const details: string[] = [];
  if (typeof data.rank === "number") details.push(`Rank: #${data.rank}`);
  if (typeof data.score === "number") details.push(`Score: ${data.score}`);
  if (details.length > 0) doc.text(details.join("     ·     "), w / 2, 365, { align: "center" });

  // Issued date
  doc.setFontSize(10);
  doc.text(`Issued on ${data.date}`, w / 2, h - 90, { align: "center" });

  // Signature line
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.5);
  doc.line(w / 2 - 100, h - 70, w / 2 + 100, h - 70);
  doc.setFontSize(10);
  doc.setTextColor(160, 160, 180);
  doc.text("Tournament Director · QuizMasters India", w / 2, h - 55, { align: "center" });

  return doc;
};

export const downloadCertificate = (data: CertificatePayload) => {
  const doc = generateCertificate(data);
  const fname = `${data.kind.toLowerCase()}-${data.quizTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(fname);
};

export const shareCertificate = async (data: CertificatePayload): Promise<boolean> => {
  if (typeof navigator === "undefined") return false;
  const doc = generateCertificate(data);
  const blob = doc.output("blob");
  const file = new File([blob], `certificate-${data.kind.toLowerCase()}.pdf`, { type: "application/pdf" });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
  try {
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share!({
        files: [file],
        title: `${data.kind === "WINNER" ? "I won" : "I played"} ${data.quizTitle} on QuizMasters India!`,
        text: `Check out my QuizMasters India certificate.`,
      });
      return true;
    }
  } catch (err) {
    console.warn("[shareCertificate] share failed:", err);
  }
  downloadCertificate(data);
  return false;
};
