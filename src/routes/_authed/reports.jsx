import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useCases, useQueueData, useRuns, useStrategies } from "@/hooks/usePv";
import { downloadAnnualSummary, downloadCsv, downloadWeeklySearchLog } from "@/lib/pdf";
import { formatDate } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";

export const Route = createFileRoute("/_authed/reports")({
  head: () => ({ meta: [{ title: "Reports · SafetyScan PV" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: runs = [] } = useRuns();
  const { data: strategies = [] } = useStrategies();
  const { data: cases = [] } = useCases();
  const { data } = useQueueData();
  const articles = data?.articles ?? [];
  const triages = data?.triages ?? [];
  const decisions = data?.decisions ?? [];

  const products = useMemo(() => [...new Set(cases.map((c) => c.product_name).filter(Boolean))], [cases]);
  const years = useMemo(() => {
    const set = new Set(cases.map((c) => String(c.day_zero || c.created_date || "").slice(0, 4)).filter(Boolean));
    return [...set].sort().reverse();
  }, [cases]);

  const [productName, setProductName] = useState(products[0] || "");
  const [year, setYear] = useState(years[0] || String(new Date().getFullYear()));

  const annualRecords = cases.filter(
    (record) =>
      record.product_name === productName &&
      String(record.day_zero || record.created_date || "").startsWith(year),
  );

  const closedRuns = runs.filter((r) => r.status === "Closed");
  const downloadableRuns = runs.filter((r) => r.status !== "Running");

  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Reports"
        description="Weekly search logs are the inspection record: date range, databases, exact query strings and versions, hit counts, duplicates, exclusions and cases. A run with zero results still produces a log stating 0 results."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="surface-card lg:col-span-7">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
            <FileText className="h-4 w-4 text-[#0D9488]" />
            <h2 className="text-[13px] font-bold text-[#0F172A]">Weekly search logs</h2>
            <span className="ml-auto text-[11px] text-[#64748B]">{closedRuns.length} closed</span>
          </div>
          <ul className="divide-y divide-[#E2E8F0]">
            {downloadableRuns.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-[#0F172A]">
                    {formatDate(run.date_range_start)} – {formatDate(run.date_range_end)}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {run.total_hits ?? 0} hits · {run.cases_created ?? 0} cases ·{" "}
                    {run.status === "Closed" ? `closed ${formatDate(run.closed_date)}` : "still open"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={run.status === "Closed" ? "green" : "amber"}>{run.status}</StatusPill>
                  <button
                    onClick={() =>
                      downloadWeeklySearchLog({
                        run,
                        strategies,
                        articles: articles.filter((a) => a.search_run === run.id),
                        triages,
                        decisions,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </li>
            ))}
            {!downloadableRuns.length && (
              <li className="px-4 py-8 text-center text-[12px] text-[#64748B]">No runs to report on yet.</li>
            )}
          </ul>
        </section>

        <section className="surface-card p-4 lg:col-span-5">
          <h2 className="text-[13px] font-bold text-[#0F172A]">Annual summary report data</h2>
          <p className="mt-1 text-[11.5px] text-[#64748B]">Per product, for one calendar year.</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Product</label>
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2 text-[12px]"
              >
                {products.map((option) => (
                  <option key={option}>{option}</option>
                ))}
                {!products.length && <option value="">No cases yet</option>}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2 text-[12px]"
              >
                {(years.length ? years : [String(new Date().getFullYear())]).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-3 rounded bg-[#F8FAFC] px-2.5 py-2 text-[11.5px] text-[#475569]">
            {annualRecords.length} case{annualRecords.length === 1 ? "" : "s"} for {productName || "this product"} in {year}.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => downloadAnnualSummary({ productName: productName || "product", year, records: annualRecords })}
              disabled={!annualRecords.length}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#0F172A] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={() =>
                downloadCsv(`SafetyScan-annual-${year}-${(productName || "product").replace(/\s+/g, "-")}.csv`, [
                  ["Case number", "Product", "Seriousness", "Criteria", "Expectedness", "Occurred in", "Reactions", "Day zero", "Due date", "Status"],
                  ...annualRecords.map((record) => [
                    record.case_number,
                    record.product_name,
                    record.seriousness,
                    (record.seriousness_criteria || []).join("; "),
                    record.expectedness,
                    record.occurred_in,
                    (record.reactions || []).join("; "),
                    record.day_zero,
                    record.due_date,
                    record.status,
                  ]),
                ])
              }
              disabled={!annualRecords.length}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#1E293B] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </section>
      </div>
    </>
  );
}