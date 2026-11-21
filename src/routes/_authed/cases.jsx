import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, FolderOpen } from "lucide-react";
import { CASE_STATUS_TONE, formatDate } from "@/lib/pv";
import { useCases } from "@/hooks/usePv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import CountdownBadge from "@/components/pv/CountdownBadge";

export const Route = createFileRoute("/_authed/cases")({
  head: () => ({ meta: [{ title: "Cases · SafetyScan PV" }] }),
  component: CasesPage,
});

const STATUSES = ["All", "Draft", "Medical Review", "Ready to Submit", "Submitted", "Closed"];

function CasesPage() {
  const { data: cases = [], isLoading } = useCases();
  const [status, setStatus] = useState("All");

  const filtered = cases.filter((c) => (status === "All" ? true : c.status === status));
  const dueSoon = cases.filter((c) => c.due_date && !["Submitted", "Closed"].includes(c.status)).length;

  return (
    <>
      <PageHeader
        eyebrow="Individual case safety reports"
        title="Cases"
        description={`${cases.length} cases on file · ${dueSoon} with a live Health Canada clock. Red countdowns are within 5 days.`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                  status === option
                    ? "border-[#0D9488] bg-teal-50 text-[#0F766E]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                <th className="px-4 py-2.5">Case</th>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Seriousness</th>
                <th className="px-4 py-2.5">Expectedness</th>
                <th className="px-4 py-2.5">Occurred in</th>
                <th className="px-4 py-2.5">Due date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map((record) => (
                <tr key={record.id} className="text-[12px] hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to="/cases/$caseId" params={{ caseId: record.id }} className="font-semibold text-[#0F172A] hover:text-[#0D9488]">
                      {record.case_number}
                    </Link>
                    {record.brand_identified === "no" && (
                      <p className="mt-0.5 text-[10px] font-semibold text-amber-700">Brand not identified</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#1E293B]">{record.product_name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={record.seriousness === "Serious" ? "red" : "slate"}>{record.seriousness}</StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={record.expectedness === "Unexpected" ? "amber" : "slate"}>{record.expectedness}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#64748B]">{record.occurred_in}</td>
                  <td className="px-4 py-3">
                    {record.due_date ? (
                      <div className="space-y-1">
                        <CountdownBadge date={record.due_date} />
                        <p className="text-[10px] text-[#64748B]">{formatDate(record.due_date)}</p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">Not reportable</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={CASE_STATUS_TONE[record.status] || "navy"}>{record.status}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: record.id }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488]"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <FolderOpen className="mx-auto h-6 w-6 text-[#CBD5E1]" />
                    <p className="mt-2 text-[12px] text-[#64748B]">
                      {isLoading ? "Loading cases…" : "No cases match this filter. Confirm a Potential Reportable Case in the review queue to create one."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}