import { useEffect, useState } from "react";
import { AlertTriangle, Gavel } from "lucide-react";
import StatusPill from "@/components/pv/StatusPill";
import { MINIMUM_CRITERIA, SERIOUSNESS_CRITERIA } from "@/lib/pv";

export default function ReportingRulesCard({ record, product, canMedical, onChangeSeriousness, onChangeExpectedness, busy }) {
  const [open, setOpen] = useState(false);
  const [seriousness, setSeriousness] = useState(record.seriousness);
  const [criteria, setCriteria] = useState(record.seriousness_criteria || []);
  const [expectedness, setExpectedness] = useState(record.expectedness);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setSeriousness(record.seriousness);
    setCriteria(record.seriousness_criteria || []);
    setExpectedness(record.expectedness);
    setReason("");
  }, [record.id, record.seriousness, record.expectedness]);

  const toggleCriterion = (value) =>
    setCriteria((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  const treatedAsUncertain = record.expectedness === "Unclear" || record.expectedness_effective === "Unexpected" && record.expectedness === "Unclear";

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0F172A]">Reporting rules</h2>
        <StatusPill tone={record.reportable_to_health_canada ? "red" : "slate"}>
          {record.reportable_to_health_canada ? "Reportable within 15 days" : "Not reportable"}
        </StatusPill>
      </div>

      <p className="mt-2 text-[12px] font-semibold text-[#1E293B]">{record.reportability_rule || "Rule not evaluated yet"}</p>
      {record.reportability_basis && <p className="mt-1 text-[11px] text-[#64748B]">{record.reportability_basis}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-[#E2E8F0] px-2 py-1.5">
          <p className="label-caps">Expectedness used</p>
          <p className="font-semibold text-[#1E293B]">{record.expectedness_effective || record.expectedness}</p>
          {treatedAsUncertain && <p className="text-[10px] text-amber-700">Treated as unexpected (uncertain)</p>}
        </div>
        <div className="rounded border border-[#E2E8F0] px-2 py-1.5">
          <p className="label-caps">Fatal outcome</p>
          <p className="font-semibold text-[#1E293B]">{record.fatal_outcome ? "Yes" : "No"}</p>
        </div>
      </div>

      {product && !product.label_complete && (
        <p className="mt-2 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Label reactions incomplete, so every reaction is treated as unexpected until the Canadian label is entered.
        </p>
      )}
      {record.brand_identified === "no" && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Brand not identified by the author. Assumed to be our product and the flag is retained.
        </p>
      )}
      {record.not_our_product && (
        <p className="mt-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[11px] text-[#475569]">
          Recorded as not our product: {record.exclusion_reason} {record.exclusion_detail ? `· ${record.exclusion_detail}` : ""}
        </p>
      )}

      {canMedical && (
        <div className="mt-3 border-t border-[#E2E8F0] pt-3">
          <button
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0D9488]"
          >
            <Gavel className="h-3 w-3" /> {open ? "Hide medical assessment" : "Change medical assessment"}
          </button>

          {open && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label-caps">Seriousness</span>
                  <select
                    value={seriousness}
                    onChange={(event) => setSeriousness(event.target.value)}
                    className="mt-1 h-8 w-full rounded border border-[#E2E8F0] bg-white px-2 text-[12px]"
                  >
                    <option>Serious</option>
                    <option>Non-serious</option>
                    <option>Unclear</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label-caps">Expectedness</span>
                  <select
                    value={expectedness}
                    onChange={(event) => setExpectedness(event.target.value)}
                    className="mt-1 h-8 w-full rounded border border-[#E2E8F0] bg-white px-2 text-[12px]"
                  >
                    <option>Expected</option>
                    <option>Unexpected</option>
                    <option>Unclear</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="label-caps">Seriousness criteria</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {SERIOUSNESS_CRITERIA.map((criterion) => (
                    <button
                      key={criterion}
                      onClick={() => toggleCriterion(criterion)}
                      className={`rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${
                        criteria.includes(criterion)
                          ? "border-[#0D9488] bg-teal-50 text-[#0F766E]"
                          : "border-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {criterion}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-[#94A3B8]">"Medically important" is a reviewer judgment.</p>
              </div>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Written reason for the change (required)"
                className="w-full rounded border border-[#E2E8F0] p-2 text-[12px] outline-none focus:border-[#0D9488]"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => onChangeSeriousness({ seriousness, criteria, reason })}
                  className="rounded bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  Save seriousness
                </button>
                <button
                  disabled={busy}
                  onClick={() => onChangeExpectedness({ expectedness, reason })}
                  className="rounded border border-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A] disabled:opacity-50"
                >
                  Save expectedness
                </button>
              </div>
              {record.seriousness_reason && (
                <p className="text-[10.5px] text-[#64748B]">
                  Last change by {record.seriousness_changed_by}: {record.seriousness_reason}
                </p>
              )}
              <p className="text-[10px] text-[#94A3B8]">
                Only a Medical Reviewer can change seriousness or expectedness. {MINIMUM_CRITERIA.length} minimum criteria are
                tracked on the case.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}