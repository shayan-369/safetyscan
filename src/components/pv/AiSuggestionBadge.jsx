import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AiSuggestionBadge({ className, compact = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-teal-300 bg-teal-50 px-2 py-1 font-bold uppercase tracking-[0.08em] text-teal-800",
        compact ? "text-[9px]" : "text-[10px]",
        className,
      )}
    >
      <Sparkles className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      AI suggestion — human review required
    </span>
  );
}