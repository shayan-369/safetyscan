import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusPill from "@/components/pv/StatusPill";
import { formatDate, RUN_STATUS_TONE } from "@/lib/pv";

const STEPS = ["Search", "Deduplication", "AI triage", "Human review", "Close run"];

export default function RunProgressCard({ run, pendingReview, activeStep, onResume }) {
  if (!run) {
    return (
      <div className="surface-card p-4">
        <p className="label-caps">Current weekly run</p>
        <p className="mt-2 text-[13px] text-[#64748B]">No run yet. Start a weekly run to begin surveillance.</p>
      </div>
    );
  }

  return (
    <div className="surface-card flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps">Current weekly run</p>
          <p className="mt-1 text-[15px] font-bold text-[#0F172A]">
            {formatDate(run.date_range_start)} – {formatDate(run.date_range_end)}
          </p>
        </div>
        <StatusPill tone={RUN_STATUS_TONE[run.status] || "navy"} dot>
          {run.status}
        </StatusPill>
      </div>

      <ol className="mt-4 space-y-2">
        {STEPS.map((step, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <li key={step} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  done && "border-[#0D9488] bg-[#0D9488] text-white",
                  active && !done && "border-[#0D9488] bg-teal-50 text-[#0F766E]",
                  !done && !active && "border-slate-200 bg-white text-slate-400",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[12px]",
                  active ? "font-semibold text-[#0F172A]" : done ? "text-[#64748B]" : "text-[#94A3B8]",
                )}
              >
                {step}
              </span>
              {active && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-[#0D9488]">Now</span>}
            </li>
          );
        })}
      </ol>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E2E8F0] pt-3">
        {[
          ["Total hits", run.total_hits ?? 0],
          ["Duplicates", run.duplicates_removed ?? 0],
          ["AI excluded", run.ai_excluded ?? 0],
          ["To review", pendingReview],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">{label}</dt>
            <dd className="text-lg font-bold tabular-nums text-[#0F172A]">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        onClick={onResume}
        className="mt-4 w-full rounded-md bg-[#0D9488] px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-[#0B7F76]"
      >
        Resume review queue ({pendingReview} pending)
      </button>
    </div>
  );
}