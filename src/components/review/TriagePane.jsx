import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import AiSuggestionBadge from "@/components/pv/AiSuggestionBadge";
import StatusPill from "@/components/pv/StatusPill";
import { CATEGORY_TONE, EXPECTEDNESS_TONE, SERIOUSNESS_TONE } from "@/lib/pv";
import { cn } from "@/lib/utils";

function Flag({ label, value }) {
  const tone = value === true || value === "yes" ? "text-emerald-700" : value === "no" ? "text-[#64748B]" : "text-amber-700";
  const text = value === true ? "Yes" : value === false ? "No" : value || "Unclear";
  return (
    <div className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
      <p className={cn("text-[11.5px] font-semibold", tone)}>{text}</p>
    </div>
  );
}

export default function TriagePane({ triage, comment, setComment, overrideCategory, setOverrideCategory, onDecide, onRetriage, busy }) {
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    setShowOverride(false);
  }, [triage?.id]);

  if (!triage) {
    return (
      <section className="surface-card p-4">
        <p className="text-[12px] text-[#64748B]">This record has no AI triage yet. Run the AI first pass to populate the fields.</p>
        <button
          onClick={onRetriage}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white"
        >
          <Sparkles className="h-3.5 w-3.5" /> Run AI triage
        </button>
      </section>
    );
  }

  return (
    <section className="surface-card flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-teal-50/40 p-3">
        <AiSuggestionBadge />
        <button
          onClick={onRetriage}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0D9488] disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" /> Re-run
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusPill tone={CATEGORY_TONE[triage.category] || "slate"}>{triage.category}</StatusPill>
          <div className="text-right">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Confidence</p>
            <p className="text-[13px] font-bold tabular-nums text-[#0F172A]">{triage.confidence}%</p>
          </div>
        </div>

        {triage.category === "Not Relevant" && triage.not_relevant_reason && (
          <p className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[11px] text-[#475569]">
            Reason: <span className="font-semibold">{triage.not_relevant_reason}</span>
          </p>
        )}
        {triage.qc_sample && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
            Quality-control sample · human review required before the run can close
          </p>
        )}
        {triage.brand_identified === "no" && (
          <p className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Brand not identified in the article. Assume the company product and record the flag.
          </p>
        )}

        <p className="text-[12px] leading-5 text-[#1E293B]">{triage.ai_summary}</p>

        <div className="grid grid-cols-2 gap-1.5">
          <Flag label="Human subject" value={triage.human_subject} />
          <Flag label="Adverse event" value={triage.adverse_event_present} />
          <Flag label="Identifiable patient" value={triage.identifiable_patient} />
          <Flag label="Identifiable reporter" value={triage.identifiable_reporter} />
          <Flag label="Suspect product named" value={triage.suspect_product_named} />
          <Flag label="Brand identified" value={triage.brand_identified} />
        </div>

        <div>
          <p className="label-caps mb-1">Reactions</p>
          <div className="flex flex-wrap gap-1">
            {(triage.reactions || []).map((reaction) => (
              <span key={reaction} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-[#475569]">
                {reaction}
              </span>
            ))}
            {!(triage.reactions || []).length && <span className="text-[11px] text-[#94A3B8]">None recorded</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <p className="label-caps mb-1">Seriousness</p>
            <StatusPill tone={SERIOUSNESS_TONE[triage.seriousness] || "slate"}>{triage.seriousness}</StatusPill>
          </div>
          <div>
            <p className="label-caps mb-1">Expectedness</p>
            <StatusPill tone={EXPECTEDNESS_TONE[triage.expectedness] || "slate"}>{triage.expectedness}</StatusPill>
          </div>
        </div>
        {(triage.seriousness_criteria || []).length > 0 && (
          <p className="text-[11px] text-[#475569]">
            <span className="font-semibold">Criteria: </span>
            {triage.seriousness_criteria.join(", ")}
          </p>
        )}
        <p className="text-[11px] text-[#475569]">
          <span className="font-semibold">Occurred in: </span>
          {triage.occurred_in}
        </p>

        {(triage.evidence_quotes || []).length > 0 && (
          <div>
            <p className="label-caps mb-1">Evidence quotes</p>
            <ul className="space-y-1">
              {triage.evidence_quotes.map((quote, index) => (
                <li key={index} className="rounded border-l-2 border-[#0D9488] bg-teal-50/50 px-2 py-1 text-[11px] italic text-[#0F766E]">
                  “{quote}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-[#E2E8F0] p-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Reviewer comment (required to override)"
          className="w-full rounded-md border border-[#E2E8F0] p-2 text-[12px] outline-none focus:border-[#0D9488]"
        />

        {showOverride && (
          <div className="mt-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              Final category
            </label>
            <select
              value={overrideCategory}
              onChange={(e) => setOverrideCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2 text-[12px]"
            >
              <option>Potential Reportable Case</option>
              <option>Safety Information/Possible Signal</option>
              <option>Not Relevant</option>
            </select>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => onDecide("Confirm AI", triage.category)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-[#0B7F76] disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> Confirm AI <span className="hidden text-[10px] opacity-70 sm:inline">(C)</span>
          </button>
          {showOverride ? (
            <button
              onClick={() => onDecide("Override", overrideCategory)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#DC2626] px-3 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              <Undo2 className="h-3.5 w-3.5" /> Save override
            </button>
          ) : (
            <button
              onClick={() => setShowOverride(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#DC2626] px-3 py-2.5 text-[12px] font-semibold text-[#DC2626]"
            >
              <Undo2 className="h-3.5 w-3.5" /> Override <span className="hidden text-[10px] opacity-70 sm:inline">(O)</span>
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-[#94A3B8]">J / K move between articles · C confirms · O overrides</p>
      </div>
    </section>
  );
}