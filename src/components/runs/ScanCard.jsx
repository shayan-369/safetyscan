import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Radar } from "lucide-react";
import { addScan } from "@/lib/icsr-fns";
import { SCAN_SOURCES, formatDate, todayISO } from "@/lib/pv";

export default function ScanCard({ runId, scans = [] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    source: "PubMed",
    queryChecked: "",
    dateRangeStart: "",
    dateRangeEnd: "",
    resultCount: 0,
    outcome: "",
  });
  const queryClient = useQueryClient();
  const submit = useServerFn(addScan);

  const save = async () => {
    setBusy(true);
    try {
      await submit({ data: { runId, ...form, resultCount: Number(form.resultCount) || 0 } });
      toast.success("Environmental scan logged");
      setOpen(false);
      setForm((prev) => ({ ...prev, queryChecked: "", outcome: "", resultCount: 0 }));
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not log the scan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
            <Radar className="h-4 w-4 text-[#0D9488]" /> Environmental scanning
          </h2>
          <p className="text-[10.5px] text-[#64748B]">
            Every source checked is recorded, including 0-result checks, and included in the weekly search log.
          </p>
        </div>
        <button
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#1E293B]"
        >
          <Plus className="h-3 w-3" /> Log scan
        </button>
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps">Source</span>
            <select
              value={form.source}
              onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
            >
              {SCAN_SOURCES.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-caps">Date checked</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-caps">Query or page checked</span>
            <input
              value={form.queryChecked}
              onChange={(event) => setForm((prev) => ({ ...prev, queryChecked: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Date range from</span>
            <input
              type="date"
              value={form.dateRangeStart}
              onChange={(event) => setForm((prev) => ({ ...prev, dateRangeStart: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Date range to</span>
            <input
              type="date"
              value={form.dateRangeEnd}
              onChange={(event) => setForm((prev) => ({ ...prev, dateRangeEnd: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Result count</span>
            <input
              type="number"
              min="0"
              value={form.resultCount}
              onChange={(event) => setForm((prev) => ({ ...prev, resultCount: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block">
            <span className="label-caps">Outcome</span>
            <input
              value={form.outcome}
              onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}
              placeholder="What was found and what was done"
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          {form.source === "Canada Vigilance online database" && (
            <p className="sm:col-span-2 rounded bg-teal-50 px-2 py-1 text-[10.5px] font-semibold text-[#0F766E]">
              Optional for case reporting, recommended for the Annual Summary Report.
            </p>
          )}
          <button
            onClick={save}
            disabled={busy || !form.queryChecked.trim()}
            className="rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Saving…" : "Save scan"}
          </button>
        </div>
      )}

      <ul className="mt-2 divide-y divide-[#E2E8F0]">
        {scans.map((scan) => (
          <li key={scan.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-[11.5px] font-semibold text-[#1E293B]">
                {formatDate(scan.date)} · {scan.source}
              </p>
              <span className="text-[10.5px] font-bold text-[#475569]">{scan.result_count ?? 0} result(s)</span>
            </div>
            <p className="text-[10.5px] text-[#64748B]">
              {scan.query_checked || "page not recorded"}
              {scan.date_range_start ? ` · ${formatDate(scan.date_range_start)} to ${formatDate(scan.date_range_end)}` : ""} ·{" "}
              {scan.performed_by}
            </p>
            {scan.outcome && <p className="text-[11px] text-[#475569]">{scan.outcome}</p>}
            {scan.optional_note && <p className="text-[10px] font-semibold text-[#0F766E]">{scan.optional_note}</p>}
          </li>
        ))}
        {!scans.length && <li className="py-2 text-[11px] text-[#94A3B8]">No environmental scans logged for this run.</li>}
      </ul>
    </section>
  );
}