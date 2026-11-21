import { AlertTriangle, Users, XCircle } from "lucide-react";
import StatusPill from "@/components/pv/StatusPill";

export default function PatientsCard({ triage, onNotOurProduct }) {
  if (!triage) return null;
  const patients = triage.patients || [];
  const specials = triage.special_situations || [];

  return (
    <section className="surface-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#0F172A]">
          <Users className="h-3.5 w-3.5 text-[#0D9488]" /> Patients identified
        </p>
        <span className="text-[10.5px] font-semibold text-[#64748B]">
          {patients.length} patient{patients.length === 1 ? "" : "s"} · one case each
        </span>
      </div>

      {triage.several_patients_unnamed && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          The article mentions several patients without individual details. No case is created; confirming this record creates
          the task "Contact author for individual patient details".
        </p>
      )}

      <ul className="mt-1.5 space-y-1.5">
        {patients.map((patient, index) => (
          <li key={`${patient.descriptor}-${index}`} className="rounded border border-[#E2E8F0] px-2 py-1.5">
            <p className="text-[11.5px] font-semibold text-[#1E293B]">{patient.descriptor}</p>
            <p className="text-[10.5px] text-[#64748B]">
              {[patient.age ? `${patient.age} years` : "age not reported", patient.sex, patient.country, patient.outcome]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-[10.5px] text-[#475569]">{(patient.reactions || []).join(", ") || "reactions not itemised"}</p>
            {patient.fatal_outcome && <StatusPill tone="red">Fatal outcome</StatusPill>}
          </li>
        ))}
        {!patients.length && !triage.several_patients_unnamed && (
          <li className="text-[11px] text-[#94A3B8]">No individually identifiable patient in this article.</li>
        )}
      </ul>

      {triage.suspect_per_author === false && (
        <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          The author does not name our product as the suspect product. Report only when our product is the suspect named by the
          author, otherwise record it as not our product.
        </p>
      )}

      {!!specials.length && (
        <div className="mt-2">
          <p className="label-caps">Special situations</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {specials.map((situation) => (
              <span key={situation} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-[#475569]">
                {situation}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2">
        <p className="text-[10.5px] text-[#64748B]">
          Relevant for the Annual Summary Report: <span className="font-semibold">{triage.relevant_for_asr === "yes" ? "Yes" : "No"}</span>
        </p>
        <button
          onClick={onNotOurProduct}
          className="inline-flex items-center gap-1 rounded border border-[#DC2626] px-2 py-1 text-[10.5px] font-semibold text-[#DC2626]"
        >
          <XCircle className="h-3 w-3" /> Not our product
        </button>
      </div>

      {triage.detected_language && !/^english$/i.test(triage.detected_language) && triage.abstract_translation && (
        <div className="mt-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2">
          <p className="label-caps">Translation from {triage.detected_language} (AI suggestion)</p>
          <p className="mt-1 text-[11px] leading-5 text-[#475569]">{triage.abstract_translation}</p>
        </div>
      )}
    </section>
  );
}