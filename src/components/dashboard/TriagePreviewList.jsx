import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import StatusPill from "@/components/pv/StatusPill";
import { CATEGORY_TONE } from "@/lib/pv";

export default function TriagePreviewList({ articles }) {
  return (
    <section className="surface-card">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <h2 className="text-[13px] font-bold text-[#0F172A]">Review queue · highest risk first</h2>
        <Link to="/review" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488]">
          Open queue <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y divide-[#E2E8F0]">
        {articles.map((a) => (
          <li key={a.id}>
            <Link to="/review" className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#0F172A]">{a.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                  {a.journal} · {a.source_database}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={CATEGORY_TONE[a.category] || "slate"}>{a.category}</StatusPill>
                  {a.brand_identified === "no" && (
                    <StatusPill tone="amber">Brand not identified</StatusPill>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Confidence</p>
                <p className="text-base font-bold tabular-nums text-[#0F172A]">{a.confidence}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}