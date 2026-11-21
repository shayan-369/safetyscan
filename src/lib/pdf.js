import { jsPDF } from "jspdf";
import { formatDate, formatDateTime } from "@/lib/pv";

const MARGIN = 48;
const WIDTH = 612;
const BOTTOM = 720;

function addText(doc, text, y, { size = 9, bold = false, color = [30, 41, 59], gap = 4 } = {}) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(String(text ?? ""), WIDTH - MARGIN * 2);
  let cursor = y;
  lines.forEach((line) => {
    if (cursor > BOTTOM) {
      doc.addPage();
      cursor = MARGIN;
    }
    doc.text(line, MARGIN, cursor);
    cursor += size + 3;
  });
  return cursor + gap;
}

function header(doc, title, subtitle) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, WIDTH, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SafetyScan PV", MARGIN, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Pharmacovigilance literature surveillance · Canada", MARGIN, 46);
  let y = 96;
  y = addText(doc, title, y, { size: 15, bold: true, color: [15, 23, 42] });
  if (subtitle) y = addText(doc, subtitle, y, { size: 9, color: [100, 116, 139], gap: 10 });
  return y;
}

export function downloadWeeklySearchLog({ run, strategies, articles, triages, decisions }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(
    doc,
    "Weekly literature search log",
    `Search period ${formatDate(run.date_range_start)} to ${formatDate(run.date_range_end)} · closed ${formatDate(run.closed_date)} by ${run.closed_by || "—"}`,
  );

  y = addText(doc, "Search strategies executed", y, { size: 11, bold: true });
  (run.strategies_used || []).forEach((entry) => {
    const strategy = strategies.find((s) => entry.startsWith(s.id));
    y = addText(
      doc,
      `• ${strategy?.product_name || "Product"} · ${strategy?.database || "PubMed"} · version ${strategy?.version ?? "—"} · query: ${strategy?.query_string || entry}`,
      y,
      { size: 8.5, color: [51, 65, 85] },
    );
  });
  if (!(run.strategies_used || []).length) y = addText(doc, "No strategies recorded for this run.", y, { size: 9 });

  y += 6;
  y = addText(doc, "Result counts", y, { size: 11, bold: true });
  const counts = [
    ["Total records retrieved", run.total_hits ?? 0],
    ["Duplicates linked (not deleted)", run.duplicates_removed ?? 0],
    ["Excluded at AI first pass", run.ai_excluded ?? 0],
    ["Sent to human review", run.sent_to_review ?? 0],
    ["Cases created", run.cases_created ?? 0],
  ];
  counts.forEach(([label, value]) => {
    y = addText(doc, `${label}: ${value}`, y, { size: 9 });
  });
  if (!run.total_hits) y = addText(doc, "0 results: no records matched the strategies in this period.", y, { size: 9, bold: true });

  y += 6;
  y = addText(doc, "Record detail", y, { size: 11, bold: true });
  articles.forEach((article, index) => {
    const triage = triages.find((t) => t.article === article.id);
    const decision = decisions.find((d) => d.article === article.id);
    const reason = article.duplicate_of
      ? "Duplicate of an earlier record (linked, not deleted)"
      : decision
        ? `Human decision: ${decision.final_category}${decision.comment ? ` — ${decision.comment}` : ""}`
        : triage
          ? `AI: ${triage.category}${triage.not_relevant_reason ? ` (${triage.not_relevant_reason})` : ""}`
          : "No triage recorded";
    y = addText(doc, `${index + 1}. ${article.title}`, y, { size: 9, bold: true });
    y = addText(
      doc,
      `${article.source_database} · ${article.journal || "journal not recorded"} · PMID ${article.pmid || "—"} · DOI ${article.doi || "—"}`,
      y,
      { size: 8, color: [100, 116, 139], gap: 2 },
    );
    y = addText(doc, reason, y, { size: 8, color: [51, 65, 85], gap: 8 });
  });
  if (!articles.length) y = addText(doc, "No records were retrieved for this period.", y, { size: 9 });

  y += 10;
  addText(doc, `Generated ${formatDateTime(new Date().toISOString())} · This log is an immutable record for Health Canada inspection.`, y, {
    size: 7.5,
    color: [148, 163, 184],
  });

  doc.save(`SafetyScan-weekly-search-log-${run.date_range_end || "run"}.pdf`);
}

export function downloadCaseReport(record, product) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(doc, `Health Canada ICSR fields · ${record.case_number}`, `Status ${record.status} · exported ${formatDateTime(new Date().toISOString())}`);

  const rows = [
    ["Case number", record.case_number],
    ["Product", record.product_name || product?.brand_name],
    ["Licence number", product?.licence_number],
    ["Patient", record.patient_initials_or_descriptor],
    ["Age", record.age ? String(record.age) : "Not reported"],
    ["Sex", record.sex],
    ["Reporter", record.reporter],
    ["Reactions", (record.reactions || []).join(", ")],
    ["Seriousness", record.seriousness],
    ["Seriousness criteria", (record.seriousness_criteria || []).join(", ") || "None"],
    ["Expectedness", record.expectedness],
    ["Occurred in", record.occurred_in],
    ["Day zero", formatDate(record.day_zero)],
    ["Due date", record.due_date ? formatDate(record.due_date) : "Not reportable"],
    ["Reportable to Health Canada", record.reportable_to_health_canada ? "Yes" : "No"],
    ["Brand identified", record.brand_identified === "no" ? "No (assumed company product)" : "Yes"],
    ["Submitted", record.submitted_date ? formatDate(record.submitted_date) : "Not submitted"],
  ];
  rows.forEach(([label, value]) => {
    y = addText(doc, `${label}: ${value ?? "—"}`, y, { size: 9, gap: 2 });
  });

  y += 8;
  y = addText(doc, "Narrative", y, { size: 11, bold: true });
  addText(doc, record.narrative || "No narrative recorded.", y, { size: 9 });
  doc.save(`SafetyScan-${record.case_number}-HealthCanada-fields.pdf`);
}

export function downloadAnnualSummary({ productName, year, records }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(doc, `Annual summary report data · ${year}`, `${productName} · ${records.length} case${records.length === 1 ? "" : "s"} in the calendar year`);

  y = addText(doc, "Cases", y, { size: 11, bold: true });
  records.forEach((record, index) => {
    y = addText(doc, `${index + 1}. ${record.case_number} · ${record.seriousness} · ${record.expectedness} · ${record.occurred_in}`, y, {
      size: 9,
      gap: 1,
    });
    y = addText(doc, `Reactions: ${(record.reactions || []).join(", ") || "—"}`, y, {
      size: 8,
      color: [100, 116, 139],
      gap: 6,
    });
  });
  if (!records.length) y = addText(doc, "No cases were recorded for this product in the selected year.", y, { size: 9 });

  const serious = records.filter((r) => r.seriousness === "Serious").length;
  const unexpected = records.filter((r) => r.expectedness === "Unexpected").length;
  y += 8;
  y = addText(doc, "Summary counts", y, { size: 11, bold: true });
  y = addText(doc, `Total cases: ${records.length}`, y, { size: 9, gap: 1 });
  y = addText(doc, `Serious: ${serious} · Non-serious: ${records.length - serious}`, y, { size: 9, gap: 1 });
  y = addText(doc, `Unexpected: ${unexpected}`, y, { size: 9 });
  doc.save(`SafetyScan-annual-summary-${productName.replace(/\s+/g, "-")}-${year}.pdf`);
}

export function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}