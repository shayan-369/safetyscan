import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Save } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatDate, pvRoleOf, todayISO } from "@/lib/pv";
import { useCaseDetail } from "@/hooks/usePv";
import { saveCase } from "@/lib/server-fns";
import { downloadCaseReport, downloadCsv } from "@/lib/pdf";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import CountdownBadge from "@/components/pv/CountdownBadge";
import AiSuggestionBadge from "@/components/pv/AiSuggestionBadge";

export const Route = createFileRoute("/_authed/cases/$caseId")({
  head: () => ({ meta: [{ title: "Case detail · SafetyScan PV" }] }),
  component: CaseDetailPage,
});

const STATUSES = ["Draft", "Medical Review", "Ready to Submit", "Submitted", "Closed"];

function Field({ label, value }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-[#1E293B]">{value || "—"}</p>
    </div>
  );
}

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const { user } = useAuth();
  const canWrite = pvRoleOf(user) !== "Inspector";
  const queryClient = useQueryClient();
  const { data, isLoading } = useCaseDetail(caseId);
  const saveFn = useServerFn(saveCase);

  const [narrative, setNarrative] = useState("");
  const [status, setStatus] = useState("Draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.record) return;
    setNarrative(data.record.narrative || "");
    setStatus(data.record.status || "Draft");
  }, [data?.record?.id, data?.record?.narrative, data?.record?.status]);

  if (isLoading || !data) return <p className="text-[13px] text-[#64748B]">Loading case…</p>;

  const { record, article, product } = data;
  const dirty = narrative !== (record.narrative || "") || status !== record.status;

  const save = async () => {
    setSaving(true);
    try {
      const patch = { narrative, status };
      if (status === "Submitted" && !record.submitted_date) patch.submitted_date = todayISO();
      await saveFn({ data: { id: record.id, patch } });
      toast.success("Case saved");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the case.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(`SafetyScan-${record.case_number}-HealthCanada-fields.csv`, [
      ["Field", "Value"],
      ["Case number", record.case_number],
      ["Product", record.product_name],
      ["Licence number", product?.licence_number],
      ["Patient", record.patient_initials_or_descriptor],
      ["Age", record.age],
      ["Sex", record.sex],
      ["Reporter", record.reporter],
      ["Reactions", (record.reactions || []).join("; ")],
      ["Seriousness", record.seriousness],
      ["Seriousness criteria", (record.seriousness_criteria || []).join("; ")],
      ["Expectedness", record.expectedness],
      ["Occurred in", record.occurred_in],
      ["Day zero", record.day_zero],
      ["Due date", record.due_date],
      ["Reportable to Health Canada", record.reportable_to_health_canada ? "Yes" : "No"],
      ["Brand identified", record.brand_identified === "no" ? "No" : "Yes"],
      ["Narrative", record.narrative],
      ["Status", record.status],
      ["Submitted", record.submitted_date],
    ]);
  };

  return (
    <>
      <Link to="/cases" className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0D9488]">
        <ArrowLeft className="h-3 w-3" /> All cases
      </Link>

      <PageHeader
        eyebrow={`Case · ${record.product_name || "product not matched"}`}
        title={record.case_number}
        description={`Day zero ${formatDate(record.day_zero)} · ${record.reportable_to_health_canada ? "reportable to Health Canada" : "not reportable"}`}
        actions={
          <>
            <StatusPill tone={record.seriousness === "Serious" ? "red" : "slate"}>{record.seriousness}</StatusPill>
            <CountdownBadge date={record.due_date} />
            <button
              onClick={() => downloadCaseReport(record, product)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-3 py-2 text-[12px] font-semibold text-white"
            >
              <FileText className="h-3.5 w-3.5" /> Health Canada PDF
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E293B]"
            >
              <Download className="h-3.5 w-3.5" /> CSV fields
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <section className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Case narrative</h2>
              <AiSuggestionBadge compact />
            </div>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              readOnly={!canWrite}
              rows={14}
              className="mt-2 w-full rounded-md border border-[#E2E8F0] p-3 text-[12.5px] leading-6 text-[#1E293B] outline-none focus:border-[#0D9488]"
            />
            {canWrite && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-[#475569]">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-[12px]"
                  >
                    {STATUSES.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save case"}
                </button>
              </div>
            )}
          </section>

          {article && (
            <section className="surface-card p-4">
              <p className="label-caps">Source article</p>
              <p className="mt-1 text-[12.5px] font-semibold text-[#0F172A]">{article.title}</p>
              <p className="mt-0.5 text-[11px] text-[#64748B]">
                {article.authors} · {article.journal} · {article.publication_date}
              </p>
              {article.pmid && (
                <a
                  href={article.full_text_url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-mono text-[11px] text-[#0D9488]"
                >
                  PMID {article.pmid}
                </a>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <section className="surface-card p-4">
            <h2 className="mb-3 text-[13px] font-bold text-[#0F172A]">Health Canada report fields</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product" value={record.product_name} />
              <Field label="Licence" value={product?.licence_number} />
              <Field label="Patient" value={record.patient_initials_or_descriptor} />
              <Field label="Age / sex" value={`${record.age || "—"} · ${record.sex}`} />
              <Field label="Reporter" value={record.reporter} />
              <Field label="Occurred in" value={record.occurred_in} />
              <Field label="Seriousness" value={record.seriousness} />
              <Field label="Criteria" value={(record.seriousness_criteria || []).join(", ")} />
              <Field label="Expectedness" value={record.expectedness} />
              <Field label="Brand identified" value={record.brand_identified === "no" ? "No" : "Yes"} />
              <Field label="Day zero" value={formatDate(record.day_zero)} />
              <Field label="Due date" value={record.due_date ? formatDate(record.due_date) : "Not reportable"} />
            </div>
            <div className="mt-3">
              <p className="label-caps">Reactions</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(record.reactions || []).map((reaction) => (
                  <span key={reaction} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-[#475569]">
                    {reaction}
                  </span>
                ))}
                {!(record.reactions || []).length && <span className="text-[11px] text-[#94A3B8]">None recorded</span>}
              </div>
            </div>
            <p className="mt-3 rounded bg-[#F8FAFC] px-2 py-1.5 text-[10.5px] text-[#64748B]">
              Due date = day zero + 15 calendar days when serious and Canadian or unexpected. Otherwise no Health Canada
              deadline applies.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}