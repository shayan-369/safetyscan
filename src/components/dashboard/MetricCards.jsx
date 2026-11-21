import { Clock, ShieldCheck, ListChecks } from "lucide-react";
import { formatDate } from "@/lib/pv";

export default function MetricCards({ autoScreened, qcReviewed, qcTotal, lastRun }) {
  const hours = ((autoScreened * 3) / 60).toFixed(1);
  const qcPct = qcTotal ? Math.round((qcReviewed / qcTotal) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[#0D9488]" />
          <p className="label-caps">Time saved this month</p>
        </div>
        <p className="mt-1.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-[#0F172A]">
          {hours} <span className="text-base font-semibold text-[#64748B]">hrs</span>
        </p>
        <p className="mt-2 text-[11px] leading-4 text-[#64748B]">
          {autoScreened} articles auto-screened × 3 minutes of manual triage
        </p>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-[#0D9488]" />
          <p className="label-caps">QC sample readiness</p>
        </div>
        <p className="mt-1.5 text-[13px] font-semibold text-[#0F172A]">
          {qcReviewed} of {qcTotal} AI exclusions re-reviewed
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${qcPct}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-[#64748B]">10% random sample must be human-reviewed before close.</p>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <p className="label-caps">Last closed run</p>
        </div>
        <p className="mt-1.5 text-[13px] font-semibold text-[#0F172A]">{formatDate(lastRun)}</p>
        <p className="mt-1 text-[11px] text-emerald-700">Date ranges continuous · zero gaps</p>
      </div>
    </div>
  );
}