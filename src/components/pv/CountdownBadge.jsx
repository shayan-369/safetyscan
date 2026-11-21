import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntil } from "@/lib/pv";

export default function CountdownBadge({ date, className }) {
  const days = daysUntil(date);
  if (days === null) {
    return <span className={cn("text-[11px] text-slate-500", className)}>No deadline</span>;
  }
  const overdue = days < 0;
  const critical = days <= 5;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold",
        overdue || critical
          ? "border-red-200 bg-red-50 text-red-700"
          : days <= 10
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-slate-50 text-slate-600",
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {overdue
        ? `${Math.abs(days)} d overdue`
        : days === 0
          ? "Due today"
          : `${days} day${days === 1 ? "" : "s"} left`}
    </span>
  );
}