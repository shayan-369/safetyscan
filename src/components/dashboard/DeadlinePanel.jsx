import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import CountdownBadge from "@/components/pv/CountdownBadge";
import { formatDate } from "@/lib/pv";

export default function DeadlinePanel({ cases }) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
          <h2 className="text-[13px] font-bold text-[#0F172A]">Health Canada deadlines · next 5 days</h2>
        </div>
        <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">{cases.length}</span>
      </div>

      {cases.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-[#64748B]">No cases due in the next 5 days.</p>
      ) : (
        <ul className="divide-y divide-[#E2E8F0]">
          {cases.map((c) => (
            <li key={c.case_number} className="border-l-4 border-l-[#DC2626]">
              <Link to="/cases" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-red-50/40">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#0F172A]">
                    {c.case_number} · {c.product}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                    Serious · {c.occurred_in} · due {formatDate(c.due_date)}
                  </p>
                </div>
                <CountdownBadge date={c.due_date} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}