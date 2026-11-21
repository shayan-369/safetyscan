import { jsPDF } from "jspdf";
import { formatDate, formatDateTime } from "@/lib/pv";

const MARGIN = 44;
const WIDTH = 612;
const BOTTOM = 730;

function text(doc, value, y, { size = 9, bold = false, color = [30, 41, 59], gap = 3, width = WIDTH - MARGIN * 2 } = {}) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  let cursor = y;
  doc.splitTextToSize(String(value ?? ""), width).forEach((line) => {
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
  doc.rect(0, 0, WIDTH, 58, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SafetyScan PV", MARGIN, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Pharmacovigilance literature surveillance · Canada", MARGIN, 42);
  let y = 84;
  y = text(doc, title, y, { size: 14, bold: true, color: [15, 23, 42] });
  if (subtitle) y = text(doc, subtitle, y, { size: 8.5, color: [100, 116, 139], gap: 8 });
  return y;
}

function section(doc, label, y) {
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  return text(doc, label, y + 14, { size: 10, bold: true, color: [13, 148, 136], gap: 4 });
}

function pair(doc, label, value, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), MARGIN, y);
  return text(doc, value || "Not reported", y + 11, { size: 9, gap: 8 });
}

const seriousYes = (record) => (record.seriousness === "Serious" ? "Yes" : "No");

function literatureReference(record, article) {
  if (!article) return "Source article not linked";
  const year = (article.publication_date || "").match(/\d{4}/)?.[0] || "";
  const ids = [article.pmid ? `PMID ${article.pmid}` : "", article.doi ? `DOI ${article.doi}` : ""].filter(Boolean).join(" · ");
  return `${article.authors || "Authors not recorded"}. ${article.title}. ${article.journal || "Journal not recorded"}; ${year}. ${ids}`;
}

/* --------------------------- Health Canada report forms --------------------------- */

export function downloadHealthCanadaForm({ record, product, article }) {
  const isNhp = product?.product_type === "Natural Health Product";
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(
    doc,
    isNhp
      ? `Mandatory Adverse Reaction Reporting Form for Industry · ${record.case_number}`
      : `CIOMS I · ${record.case_number}`,
    `${isNhp ? "Natural health product" : "Drug"} · version ${record.version || 1} · exported ${formatDateTime(new Date().toISOString())}`,
  );

  y = section(doc, "0. Report and source", y);
  y = pair(doc, "Report type", "Spontaneous report from the scientific literature", y);
  y = pair(doc, "Literature reference", literatureReference(record, article), y);
  y = pair(doc, "Case number", record.case_number, y);
  y = pair(doc, "Reportable within 15 days", record.reportable_to_health_canada ? "Yes" : "No", y);
  y = pair(doc, "Rule applied", record.reportability_rule || "Not recorded", y);
  if (record.reportability_basis) y = text(doc, record.reportability_basis, y, { size: 8, color: [100, 116, 139], gap: 8 });

  y = section(doc, "1. Patient", y);
  y = pair(doc, "Patient", record.patient_initials_or_descriptor, y);
  y = pair(doc, "Age", record.age ? `${record.age} years` : "Not reported", y);
  y = pair(doc, "Sex", record.sex, y);
  y = pair(doc, "Country of reaction", record.occurred_in, y);

  y = section(doc, "2. Adverse reaction", y);
  (record.reactions_coded || []).forEach((entry) => {
    y = text(
      doc,
      `Verbatim: ${entry.verbatim} · MedDRA PT: ${entry.reviewer_pt || entry.ai_pt || "not coded"}${
        entry.confirmed ? " (confirmed)" : " (unverified)"
      }${entry.meddra_version ? ` · MedDRA ${entry.meddra_version}` : ""}`,
      y,
      { size: 8.5, gap: 2 },
    );
  });
  if (!(record.reactions_coded || []).length) y = text(doc, (record.reactions || []).join(", ") || "Not reported", y, { size: 8.5 });
  y = pair(doc, "Serious", seriousYes(record), y);
  y = pair(doc, "Seriousness criteria", (record.seriousness_criteria || []).join(", ") || "None", y);
  y = pair(
    doc,
    "Expectedness",
    `${record.expectedness_effective || record.expectedness}${
      record.expectedness_effective === "Unexpected" && record.expectedness === "Unclear"
        ? " (treated as unexpected, uncertain)"
        : ""
    }`,
    y,
  );

  y = section(doc, "3. Suspect product", y);
  y = pair(doc, "Product", record.product_name || product?.brand_name, y);
  y = pair(doc, isNhp ? "NPN" : "DIN", record.nhp_npn || product?.licence_number, y);
  y = pair(doc, "Active ingredients", (product?.active_ingredients || []).join(", "), y);
  y = pair(doc, "Brand identified by the author", record.brand_identified === "no" ? "No, assumed our product" : "Yes", y);
  if (isNhp) {
    y = pair(doc, "Latin binomial", record.latin_binomial, y);
    y = pair(doc, "Plant part", record.plant_part, y);
    y = pair(doc, "Extract type", record.extract_type, y);
    y = pair(doc, "Solvent", record.solvent, y);
    y = pair(doc, "Ingredients and quantities", record.ingredients_quantities, y);
    y = pair(doc, "Homeopathic potency", record.homeopathic_potency, y);
  }

  y = section(doc, "4. Reporter", y);
  y = pair(doc, "Reporter", record.reporter || "Article authors", y);
  y = pair(doc, "Received", formatDate(record.received_date || record.day_zero), y);
  y = pair(doc, "Day zero", formatDate(record.day_zero), y);

  y = section(doc, "5. Narrative", y);
  y = text(doc, record.narrative || "No narrative recorded.", y, { size: 8.5, gap: 8 });

  y = section(doc, "6. Company assessment", y);
  y = pair(doc, "Approved by", record.approved_by ? `${record.approved_by} (${record.approved_role})` : "Not approved", y);
  y = pair(doc, "Approved at", record.approved_at ? formatDateTime(record.approved_at) : "Not approved", y);
  y = pair(doc, "Submission", record.submission_method || "Not submitted", y);
  y = pair(doc, "Health Canada acknowledgement", record.health_canada_ack, y);

  text(doc, "Do not send this report to Health Canada by email. Submit through the regulated channel and record the acknowledgement number.", BOTTOM, {
    size: 7.5,
    color: [148, 163, 184],
  });
  doc.save(`SafetyScan-${record.case_number}-${isNhp ? "NHP-form" : "CIOMS-I"}.pdf`);
}

/* ------------------------------- E2B(R3) draft ------------------------------- */

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function downloadE2bXml({ record, product, article }) {
  const reactionBlocks = (record.reactions_coded?.length ? record.reactions_coded : (record.reactions || []).map((r) => ({ verbatim: r })))
    .map(
      (entry, index) => `      <reaction>
        <reactionsequence>${index + 1}</reactionsequence>
        <primarysourcereaction>${escapeXml(entry.verbatim)}</primarysourcereaction>
        <reactionmeddrapt>${escapeXml(entry.reviewer_pt || entry.ai_pt || "")}</reactionmeddrapt>
        <reactionmeddraversion>${escapeXml(entry.meddra_version || "")}</reactionmeddraversion>
        <reactionoutcome>${escapeXml(record.outcome || "unknown")}</reactionoutcome>
      </reaction>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Draft - validate before submission. Generated by SafetyScan PV on ${new Date().toISOString()} -->
<ichicsr lang="en">
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messageformatversion>E2B(R3)</messageformatversion>
    <messageformatrelease>2.0</messageformatrelease>
    <messagenumb>${escapeXml(record.case_number)}</messagenumb>
    <messagesenderidentifier>SEAFORD-PV</messagesenderidentifier>
    <messagereceiveridentifier>HC-SC</messagereceiveridentifier>
    <messagedateformat>204</messagedateformat>
    <messagedate>${escapeXml((record.submitted_date || new Date().toISOString()).slice(0, 10))}</messagedate>
  </ichicsr>
  <safetyreport>
    <safetyreportversion>${record.version || 1}</safetyreportversion>
    <safetyreportid>${escapeXml(record.case_number)}</safetyreportid>
    <primarysourcecountry>${escapeXml(record.occurred_in || "unknown")}</primarysourcecountry>
    <reporttype>1</reporttype>
    <serious>${record.seriousness === "Serious" ? "1" : "2"}</serious>
    <receivedate>${escapeXml(record.received_date || record.day_zero || "")}</receivedate>
    <receiptdate>${escapeXml(record.day_zero || "")}</receiptdate>
    <literaturereference>${escapeXml(literatureReference(record, article))}</literaturereference>
    <patient>
      <patientinitial>${escapeXml(record.patient_initials_or_descriptor)}</patientinitial>
      <patientonsetage>${escapeXml(record.age || "")}</patientonsetage>
      <patientsex>${record.sex === "Female" ? "2" : record.sex === "Male" ? "1" : "0"}</patientsex>
    </patient>
    <reactions>
${reactionBlocks}
    </reactions>
    <suspectdrug>
      <drugname>${escapeXml(record.product_name || product?.brand_name)}</drugname>
      <drugindication>${escapeXml(product?.indication || "")}</drugindication>
      <drugdosageform>${escapeXml(product?.product_type || "")}</drugdosageform>
    </suspectdrug>
    <narrative>${escapeXml(record.narrative)}</narrative>
    <senderorganization>Seaford Pharmaceuticals</senderorganization>
    <senderdepartment>Pharmacovigilance</senderdepartment>
  </safetyreport>
</ichicsr>
`;
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SafetyScan-${record.case_number}-E2B-R3-draft.xml`;
  link.click();
  URL.revokeObjectURL(url);
}

/* --------------------------- Annual Summary Report --------------------------- */

export function downloadAnnualReport({ report, cases }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(
    doc,
    `Annual Summary Report · ${report.product_name}`,
    `${formatDate(report.period_start)} to ${formatDate(report.period_end)} · due ${formatDate(report.due_date)}`,
  );

  y = section(doc, "Cases in the reporting period", y);
  y = text(doc, `${cases.length} case${cases.length === 1 ? "" : "s"} · ${cases.filter((c) => c.seriousness === "Serious").length} serious`, y, { size: 9, gap: 4 });
  y = text(doc, report.line_listing || "No cases in the period.", y, { size: 8, gap: 8 });

  y = section(doc, "Significant literature findings", y);
  y = text(doc, report.literature_findings || "None recorded.", y, { size: 8.5, gap: 8 });

  y = section(doc, "Signals opened, ongoing or closed", y);
  y = text(doc, report.signals_summary || "No signals in the period.", y, { size: 8.5, gap: 8 });

  y = section(doc, "Special situations", y);
  y = text(doc, report.special_situations_summary || "None recorded.", y, { size: 8.5, gap: 8 });

  y = section(doc, "Label changes", y);
  y = text(doc, report.label_changes || "None recorded.", y, { size: 8.5, gap: 8 });

  y = section(doc, "Critical analysis (AI draft, reviewed and signed by a Medical Reviewer)", y);
  y = text(doc, report.critical_analysis || "Not drafted.", y, { size: 8.5, gap: 8 });

  y = section(doc, "Medical Reviewer conclusion", y);
  y = pair(doc, "Significant change in benefit-risk", report.significant_change === "yes" ? "Yes" : "No", y);
  y = pair(doc, "Rationale", report.rationale, y);
  y = pair(doc, "Signed by", report.signed_by ? `${report.signed_by} (${report.signed_role})` : "Not signed", y);
  y = pair(doc, "Signed at", report.signed_at ? formatDateTime(report.signed_at) : "Not signed", y);

  doc.save(`SafetyScan-ASR-${report.product_name.replace(/\s+/g, "-")}-${report.period_end}.pdf`);
}