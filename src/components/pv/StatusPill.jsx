import { cn } from "@/lib/utils";

const TONES = {
  teal: "bg-teal-50 text-teal-800 border-teal-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  navy: "bg-slate-100 text-slate-700 border-slate-200",
  slate: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function StatusPill({ children, tone = "navy", className, dot = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold",
        TONES[tone] || TONES.navy,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}