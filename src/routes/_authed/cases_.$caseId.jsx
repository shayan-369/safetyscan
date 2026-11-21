import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, FileCode2, FileText, Save } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatDate, pvRoleOf } from "@/lib/pv";
import { useCaseDetail, useCaseFamily } from "@/hooks/usePv";
import { saveCase } from "@/lib/server-fns";
import {
  approveCase,
  changeExpectedness,
  changeSeriousness,
  saveFullText,
  setDayZero,
  submitCase,
} from "@/lib/icsr-fns";
import { downloadCsv } from "@/lib/pdf";
import { downloadE2bXml, downloadHealthCanadaForm } from "@/lib/report-pdf";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import CountdownBadge from "@/components/pv/CountdownBadge";
import AiSuggestionBadge from "@/components/pv/AiSuggestionBadge";
import ReportingRulesCard from "@/components/case/ReportingRulesCard";
import DayZeroCard from "@/components/case/DayZeroCard";
import ReactionCodingCard from "@/components/case/ReactionCodingCard";
import NhpCard from "@/components/case/NhpCard";
import FollowUpCard from "@/components/case/FollowUpCard";
import ApprovalCard from "@/components/case/ApprovalCard";
import NullifyCard from "@/components/case/NullifyCard";

export const Route = createFileRoute("/_authed/cases_/$caseId")({
  head: () => ({ meta: [{ title: "Case detail · SafetyScan PV" }] }),
  component: CaseDetailPage,
});

const EDITABLE_STATUSES = ["Draft", "Medical Review", "Follow-up", "Closed"];

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
  const role = pvRoleOf(user);
  const canWrite = role !== "Inspector";
  const canMedical = ["Medical Reviewer", "Admin"].includes(role);
  const queryClient = useQueryClient();
  const { data, isLoading } = useCaseDetail(caseId);
  const { data: versions = [] } = useCaseFamily(data?.record);

  const saveFn = useServerFn(saveCase);
  const dayZeroFn = useServerFn(setDayZero);
  const seriousnessFn = useServerFn(changeSeriousness);
  const expectednessFn = useServerFn(changeExpectedness);
  const approveFn = useServerFn(approveCase);
  const submitFn = useServerFn(submitCase);
  const fullTextFn = useServerFn(saveFullText);

  const [narrative, setNarrative] = useState("");
  const [status, setStatus] = useState("Draft");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data?.record) return;
    setNarrative(data.record.narrative || "");
    setStatus(data.record.status || "Draft");
  }, [data?.record?.id, data?.record?.narrative, data?.record?.status]);

  if (isLoading || !data) return <p className="text-[13px] text-[#64748B]">Loading case…</p>;

  const { record, article, product, triage, followUps = [] } = data;
  const dirty = narrative !== (record.narrative || "") || status !== record.status;

  const run = async (action, message) => {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the change.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (values, message = "Case saved") =>
    run(() => saveFn({ data: { id: record.id, patch: values } }), message);

  const exportCsv = () => {
    downloadCsv(`SafetyScan-${record.case_number}-HealthCanada-fields.csv`, [
      ["Field", "Value"],
      ["Case number", record.case_number],
      ["Version", record.version || 1],
      ["Product", record.product_name],
      ["DIN or NPN", record.nhp_npn || product?.licence_number],
      ["Patient", record.patient_initials_or_descriptor],
      ["Age", record.age],
      ["Sex", record.sex],
      ["Reporter", record.reporter],
      ["Reactions", (record.reactions || []).join("; ")],
      ["Seriousness", record.seriousness],
      ["Seriousness criteria", (record.seriousness_criteria || []).join("; ")],
      ["Expectedness used", record.expectedness_effective || record.expectedness],
      ["Occurred in", record.occurred_in],
      ["Reporting rule", record.reportability_rule],
      ["Day zero", record.day_zero],
      ["Due date", record.due_date],
      ["Reportable", record.reportable_to_health_canada ? "Yes" : "No"],
      ["Full text", record.full_text_status],
      ["Approved by", record.approved_by],
      ["Submitted", record.submitted_date],
      ["Health Canada acknowledgement", record.health_canada_ack],
      ["Narrative", record.narrative],
    ]);
  };

  return (
    <>
      <Link to="/cases" className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0D9488]">
        <ArrowLeft className="h-3 w-3" /> All cases
      </Link>

      <PageHeader
        eyebrow={`Case ${record.version > 1 ? `· version ${record.version}` : ""} · ${record.product_name || "product not matched"}`}
        title={record.case_number}
        description={`Day zero ${formatDate(record.day_zero)} · ${record.reportable_to_health_canada ? "reportable to Health Canada" : "not reportable"}${record.patient_index != null ? ` · patient ${Number(record.patient_index) + 1} of the article` : ""}`}
        actions={
          <>
            <StatusPill tone={record.seriousness === "Serious" ? "red" : "slate"}>{record.seriousness}</StatusPill>
            <CountdownBadge date={record.due_date} />
            <button
              onClick={() => downloadHealthCanadaForm({ record, product, article })}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-3 py-2 text-[12px] font-semibold text-white"
            >
              <FileText className="h-3.5 w-3.5" /> Health Canada report
            </button>
            <button
              onClick={() => downloadE2bXml({ record, product, article })}
              title="Draft - validate before submission"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E293B]"
            >
              <FileCode2 className="h-3.5 w-3.5" /> E2B(R3) draft
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E293B]"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <ReportingRulesCard
            record={record}
            product={product}
            canMedical={canMedical}
            busy={busy}
            onChangeSeriousness={(values) =>
              run(() => seriousnessFn({ data: { id: record.id, ...values } }), "Seriousness updated and the reporting rule recalculated")
            }
            onChangeExpectedness={(values) =>
              run(() => expectednessFn({ data: { id: record.id, ...values } }), "Expectedness updated and the reporting rule recalculated")
            }
          />

          <DayZeroCard
            record={record}
            canWrite={canWrite}
            busy={busy}
            onSave={(values) =>
              run(() => dayZeroFn({ data: { id: record.id, ...values } }), "Minimum criteria saved and the reporting rule recalculated")
            }
          />

          <section className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Case narrative</h2>
              <AiSuggestionBadge compact />
            </div>
            <textarea
              value={narrative}
              onChange={(event) => setNarrative(event.target.value)}
              readOnly={!canWrite}
              rows={12}
              className="mt-2 w-full rounded-md border border-[#E2E8F0] p-3 text-[12.5px] leading-6 text-[#1E293B] outline-none focus:border-[#0D9488]"
            />
            <p className="mt-1 text-[10.5px] text-[#64748B]">
              The narrative must stand alone, avoid abbreviations, and never carry a detail that is missing from the structured
              fields.
            </p>
            {canWrite && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-[#475569]">Workflow status</label>
                  <select
                    value={EDITABLE_STATUSES.includes(status) ? status : record.status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-[12px]"
                  >
                    {EDITABLE_STATUSES.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                    {!EDITABLE_STATUSES.includes(record.status) && <option>{record.status}</option>}
                  </select>
                </div>
                <button
                  onClick={() => patch({ narrative, status }, "Case saved")}
                  disabled={busy || !dirty}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save case"}
                </button>
              </div>
            )}
          </section>

          <ReactionCodingCard record={record} canWrite={canWrite} busy={busy} onSave={(rows) => patch({ reactions_coded: rows }, "Reaction coding saved")} />

          {product?.product_type === "Natural Health Product" && (
            <NhpCard record={record} canWrite={canWrite} busy={busy} onSave={(values) => patch(values, "Natural health product fields saved")} />
          )}

          <FollowUpCard record={record} followUps={followUps} canWrite={canWrite} versions={versions} />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <section className="surface-card p-4">
            <h2 className="mb-3 text-[13px] font-bold text-[#0F172A]">Health Canada report fields</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product" value={record.product_name} />
              <Field label={product?.product_type === "Natural Health Product" ? "NPN" : "DIN"} value={record.nhp_npn || product?.licence_number} />
              <Field label="Patient" value={record.patient_initials_or_descriptor} />
              <Field label="Age / sex" value={`${record.age || "—"} · ${record.sex}`} />
              <Field label="Reporter" value={record.reporter} />
              <Field label="Occurred in" value={record.occurred_in} />
              <Field label="Seriousness" value={record.seriousness} />
              <Field label="Criteria" value={(record.seriousness_criteria || []).join(", ")} />
              <Field label="Expectedness" value={`${record.expectedness_effective || record.expectedness}${record.expectedness === "Unclear" ? " (treated as unexpected, uncertain)" : ""}`} />
              <Field label="Brand identified" value={record.brand_identified === "no" ? "No (assumed ours)" : "Yes"} />
              <Field label="Received" value={formatDate(record.received_date)} />
              <Field label="Due date" value={record.due_date ? formatDate(record.due_date) : "Not reportable"} />
            </div>
            {triage && (
              <p className="mt-3 rounded bg-[#F8FAFC] px-2 py-1.5 text-[10.5px] text-[#64748B]">
                AI model {triage.ai_model || "not recorded"} · prompt {triage.prompt_version || "not recorded"} · confidence{" "}
                {triage.confidence}% · suggestion only
              </p>
            )}
          </section>

          <ApprovalCard
            record={record}
            canMedical={canMedical}
            canWrite={canWrite}
            busy={busy}
            onApprove={(values) => run(() => approveFn({ data: { id: record.id, ...values } }), "Case approved with electronic signature")}
            onSubmit={(values) =>
              run(() => submitFn({ data: { id: record.id, ...values } }), "Submission recorded with the Health Canada acknowledgement")
            }
            onFullText={(values) => run(() => fullTextFn({ data: { caseId: record.id, ...values } }), "Full text status saved")}
          />

          <NullifyCard record={record} canMedical={canMedical} />

          {article && (
            <section className="surface-card p-4">
              <p className="label-caps">Source literature reference</p>
              <p className="mt-1 text-[12.5px] font-semibold text-[#0F172A]">{article.title}</p>
              <p className="mt-0.5 text-[11px] text-[#64748B]">
                {article.authors} · {article.journal} · {article.publication_date}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {article.doi && (
                  <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#0D9488]">
                    DOI {article.doi}
                  </a>
                )}
                {article.pmid && (
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-[#0D9488]"
                  >
                    PMID {article.pmid}
                  </a>
                )}
                {article.pmc_id && (
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmc_id}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-[#0D9488]"
                  >
                    {article.pmc_id}
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <p className="mt-4 rounded border border-[#E2E8F0] bg-white px-3 py-2 text-[10.5px] text-[#64748B]">
        The E2B(R3) export is a draft - validate before submission. Reports must not be sent to Health Canada by email.
        Records are retained for 25 years.
      </p>
    </>
  );
}