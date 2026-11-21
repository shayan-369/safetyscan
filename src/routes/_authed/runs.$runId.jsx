import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, FileUp, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { CATEGORY_TONE, formatDate, pvRoleOf, RUN_STATUS_TONE, SERIOUSNESS_TONE } from "@/lib/pv";
import { useRunWorkspace } from "@/hooks/usePv";
import { closeRun } from "@/lib/server-fns";
import { downloadWeeklySearchLog } from "@/lib/pdf";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import ImportDialog from "@/components/runs/ImportDialog";

export const Route = createFileRoute("/_authed/runs/$runId")({
  head: () => ({ meta: [{ title: "Run detail · SafetyScan PV" }] }),
  component: RunDetailPage,
});

function RunDetailPage() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const canWrite = pvRoleOf(user) !== "Inspector";
  const queryClient = useQueryClient();
  const { data, isLoading } = useRunWorkspace(runId);
  const [importOpen, setImportOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const close = useServerFn(closeRun);

  if (isLoading || !data) return <p className="text-[13px] text-[#64748B]">Loading run…</p>;

  const { run, triages, decisions, runs, strategies } = data;
  const articles = data.articles.filter((a) => a.search_run === runId);
  const triageFor = (id) => triages.find((t) => t.article === id);
  const decisionFor = (id) => decisions.find((d) => d.article === id);
  const duplicateFor = (article) => data.articles.find((a) => a.id === article.duplicate_of);
  const runLabel = (id) => {
    const found = runs.find((r) => r.id === id);
    return found ? `${formatDate(found.date_range_start)} – ${formatDate(found.date_range_end)}` : "an earlier run";
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const result = await close({ data: { runId } });
      toast.success(`Run closed · ${result.casesCreated} case${result.casesCreated === 1 ? "" : "s"} in the weekly log.`);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not close the run.");
    } finally {
      setClosing(false);
    }
  };

  const download = () => {
    downloadWeeklySearchLog({ run, strategies, articles, triages, decisions });
  };

  return (
    <>
      <Link to="/runs" className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0D9488]">
        <ArrowLeft className="h-3 w-3" /> All runs
      </Link>

      <PageHeader
        eyebrow={`Search run · ${run.frequency || "Weekly"}`}
        title={`${formatDate(run.date_range_start)} – ${formatDate(run.date_range_end)}`}
        description={`${run.total_hits ?? 0} records retrieved · ${run.duplicates_removed ?? 0} duplicates linked · ${run.ai_excluded ?? 0} excluded at AI first pass · ${run.sent_to_review ?? 0} sent to review`}
        actions={
          <>
            <StatusPill tone={RUN_STATUS_TONE[run.status] || "navy"} dot>
              {run.status}
            </StatusPill>
            {canWrite && run.status !== "Closed" && (
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E293B]"
              >
                <FileUp className="h-3.5 w-3.5" /> Import CSV / RIS
              </button>
            )}
            {canWrite && run.status === "Awaiting Review" && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
              >
                <Lock className="h-3.5 w-3.5" /> {closing ? "Closing…" : "Close run"}
              </button>
            )}
            {run.status === "Closed" && (
              <button
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" /> Weekly search log PDF
              </button>
            )}
          </>
        }
      />

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">AI suggestion</th>
                <th className="px-4 py-2.5">Seriousness</th>
                <th className="px-4 py-2.5">Human decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {articles.map((article) => {
                const triage = triageFor(article.id);
                const decision = decisionFor(article.id);
                const duplicate = article.duplicate_of ? duplicateFor(article) : null;
                return (
                  <tr key={article.id} className="align-top text-[12px] hover:bg-slate-50">
                    <td className="max-w-[420px] px-4 py-3">
                      <p className="font-semibold text-[#0F172A]">{article.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        {article.journal || "Journal not recorded"} · {article.publication_date || "date unknown"}
                      </p>
                      {article.duplicate_of && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
                          Seen before in run {runLabel(duplicate?.search_run)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#64748B]">{article.source_database}</td>
                    <td className="px-4 py-3">
                      {triage ? (
                        <div className="space-y-1">
                          <StatusPill tone={CATEGORY_TONE[triage.category] || "slate"}>{triage.category}</StatusPill>
                          <p className="flex items-center gap-1 text-[10px] text-[#64748B]">
                            <Sparkles className="h-2.5 w-2.5 text-[#0D9488]" /> confidence {triage.confidence} · requires review
                          </p>
                          {triage.qc_sample && <StatusPill tone="amber">QC sample</StatusPill>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8]">Not triaged</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {triage ? <StatusPill tone={SERIOUSNESS_TONE[triage.seriousness] || "slate"}>{triage.seriousness}</StatusPill> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {decision ? (
                        <div>
                          <StatusPill tone={CATEGORY_TONE[decision.final_category] || "slate"}>{decision.final_category}</StatusPill>
                          <p className="mt-1 text-[10.5px] text-[#64748B]">
                            {decision.decision} · {decision.reviewer}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8]">{article.duplicate_of ? "Duplicate" : "Pending"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!articles.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#64748B]">
                    0 results for this period. The run still produces a weekly search log stating 0 results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        runId={runId}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["pv"] })}
      />
    </>
  );
}