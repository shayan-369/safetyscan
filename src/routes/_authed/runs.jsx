import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatDate, pvRoleOf, RUN_STATUS_TONE } from "@/lib/pv";
import { useRuns, useStrategies } from "@/hooks/usePv";
import { startWeeklyRun } from "@/lib/server-fns";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";

export const Route = createFileRoute("/_authed/runs")({
  head: () => ({ meta: [{ title: "Search runs · SafetyScan PV" }] }),
  component: RunsPage,
});

function findGaps(runs) {
  const ordered = [...runs]
    .filter((r) => r.date_range_start && r.date_range_end)
    .sort((a, b) => new Date(a.date_range_start) - new Date(b.date_range_start));
  const gaps = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const previousEnd = new Date(`${ordered[i - 1].date_range_end}T00:00:00Z`);
    const nextStart = new Date(`${ordered[i].date_range_start}T00:00:00Z`);
    const expected = new Date(previousEnd);
    expected.setUTCDate(expected.getUTCDate() + 1);
    if (nextStart > expected) {
      gaps.push({ from: ordered[i - 1].date_range_end, to: ordered[i].date_range_start });
    }
  }
  return gaps;
}

function RunsPage() {
  const { user } = useAuth();
  const canWrite = pvRoleOf(user) !== "Inspector";
  const queryClient = useQueryClient();
  const { data: runs = [], isLoading } = useRuns();
  const { data: strategies = [] } = useStrategies();
  const [starting, setStarting] = useState(false);
  const startRun = useServerFn(startWeeklyRun);

  const gaps = findGaps(runs);

  const run = async () => {
    setStarting(true);
    try {
      const result = await startRun({});
      toast.success(
        `Run started: ${result.totalHits} records, ${result.duplicates} duplicates, ${result.sentToReview} sent to review.`,
      );
      if (result.warnings?.length) toast.warning(result.warnings[0]);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not start the weekly run.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Surveillance"
        title="Weekly search runs"
        description="Each run starts exactly where the previous one ended, so no publication date is ever missed. PubMed is queried for every active strategy, then Embase or Canada Vigilance exports can be added to the same run."
        actions={
          canWrite && (
            <button
              onClick={run}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#0B7F76] disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" />
              {starting ? "Running PubMed search…" : "Start weekly run"}
            </button>
          )
        }
      />

      {gaps.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
          <div>
            <p className="text-[12px] font-bold text-[#991B1B]">Coverage gap detected</p>
            <p className="text-[11.5px] text-[#B91C1C]">
              {gaps.map((g) => `${formatDate(g.from)} → ${formatDate(g.to)}`).join(", ")} is not covered by any run. Run a
              catch-up search for that period.
            </p>
          </div>
        </div>
      )}

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Hits</th>
                <th className="px-4 py-2.5 text-right">Duplicates</th>
                <th className="px-4 py-2.5 text-right">AI excluded</th>
                <th className="px-4 py-2.5 text-right">To review</th>
                <th className="px-4 py-2.5 text-right">Cases</th>
                <th className="px-4 py-2.5">Closed</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {runs.map((r) => (
                <tr key={r.id} className="text-[12px] text-[#1E293B] hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">
                    {formatDate(r.date_range_start)} – {formatDate(r.date_range_end)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={RUN_STATUS_TONE[r.status] || "navy"} dot>
                      {r.status}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_hits ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.duplicates_removed ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.ai_excluded ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.sent_to_review ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.cases_created ?? 0}</td>
                  <td className="px-4 py-3 text-[11px] text-[#64748B]">
                    {r.closed_date ? `${formatDate(r.closed_date)} · ${r.closed_by || ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/runs/$runId"
                      params={{ runId: r.id }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488]"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!runs.length && !isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[12px] text-[#64748B]">
                    No runs yet. Start a weekly run to search PubMed with {strategies.filter((s) => s.active).length} active
                    strateg{strategies.filter((s) => s.active).length === 1 ? "y" : "ies"}.
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