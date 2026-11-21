import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { MINIMUM_CRITERIA, formatDate } from "@/lib/pv";

export default function DayZeroCard({ record, onSave, canWrite, busy }) {
  const [checklist, setChecklist] = useState({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    setChecklist({
      day0_reporter: !!record.day0_reporter,
      day0_patient: !!record.day0_patient,
      day0_product: !!record.day0_product,
      day0_reaction: !!record.day0_reaction,
    });
    setReason("");
  }, [record.id, record.day0_reporter, record.day0_patient, record.day0_product, record.day0_reaction]);

  const complete = MINIMUM_CRITERIA.every((criterion) => checklist[criterion.key]);

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
          <CalendarCheck className="h-4 w-4 text-[#0D9488]" /> Four minimum criteria and day zero
        </h2>
        <span className={`text-[11px] font-bold ${record.day_zero ? "text-[#0F766E]" : "text-amber-700"}`}>
          Day zero {record.day_zero ? formatDate(record.day_zero) : "not set"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {MINIMUM_CRITERIA.map((criterion) => (
          <label key={criterion.key} className="flex items-center gap-2 rounded border border-[#E2E8F0] px-2 py-1.5 text-[11.5px]">
            <input
              type="checkbox"
              checked={!!checklist[criterion.key]}
              disabled={!canWrite}
              onChange={(event) => setChecklist((prev) => ({ ...prev, [criterion.key]: event.target.checked }))}
              className="h-3.5 w-3.5 accent-[#0D9488]"
            />
            <span className="text-[#1E293B]">{criterion.label}</span>
          </label>
        ))}
      </div>

      <p className="mt-2 text-[10.5px] text-[#64748B]">
        Day zero is the date all four criteria are first confirmed. Changing it restarts the 15-day clock and needs a written
        reason.
      </p>

      {canWrite && (
        <div className="mt-2 space-y-2">
          {record.day_zero && (
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for changing day zero (required if it moves)"
              className="h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
            />
          )}
          <button
            onClick={() => onSave({ checklist, reason })}
            disabled={busy}
            className="rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {complete && !record.day_zero ? "Confirm criteria and set day zero" : "Save criteria"}
          </button>
        </div>
      )}
    </section>
  );
}