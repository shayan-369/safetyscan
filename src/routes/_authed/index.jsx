import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/pv/PageHeader";
import RunProgressCard from "@/components/dashboard/RunProgressCard";
import DeadlinePanel from "@/components/dashboard/DeadlinePanel";
import TriagePreviewList from "@/components/dashboard/TriagePreviewList";
import MetricCards from "@/components/dashboard/MetricCards";
import { useCases, useQueueData } from "@/hooks/usePv";
import { CATEGORY_ORDER, daysUntil, findRunGaps, formatDate } from "@/lib/pv";

export const Route = createFileRoute("/_authed/")({
  head: () => ({ meta: [{ title: "Dashboard · SafetyScan PV" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQueueData();
  const { data: cases = [] } = useCases();

  const runs = data?.runs ?? [];
  const articles = data?.articles ?? [];
  const triages = data?.triages ?? [];
  const decisions = data?.decisions ?? [];

  const triageByArticle = new Map(triages.map((t) => [t.article, t]));
  const decided = new Set(decisions.map((d) => d.article));

  const currentRun = runs.find((r) => r.status !== "Closed") || runs[0] || null;

  const queue = articles
    .filter((article) => !article.duplicate_of && !decided.has(article.id))
    .filter((article) => {
      const triage = triageByArticle.get(article.id);
      if (!triage) return true;
      return triage.category !== "Not Relevant" || triage.qc_sample;
    })
    .sort((a, b) => {
      const ta = triageByArticle.get(a.id);
      const tb = triageByArticle.get(b.id);
      const order = CATEGORY_ORDER.indexOf(ta?.category) - CATEGORY_ORDER.indexOf(tb?.category);
      return order !== 0 ? order : (tb?.confidence || 0) - (ta?.confidence || 0);
    });

  const previewArticles = queue.slice(0, 3).map((article) => {
    const triage = triageByArticle.get(article.id);
    return {
      id: article.id,
      title: article.title,
      journal: article.journal,
      source_database: article.source_database,
      category: triage?.category || "Awaiting triage",
      brand_identified: triage?.brand_identified,
      confidence: triage?.confidence ?? 0,
    };
  });

  const dueCases = cases
    .filter((record) => record.due_date && !["Submitted", "Closed"].includes(record.status))
    .filter((record) => {
      const days = daysUntil(record.due_date);
      return days !== null && days <= 5;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .map((record) => ({
      case_number: record.case_number,
      product: record.product_name,
      occurred_in: record.occurred_in,
      due_date: record.due_date,
    }));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const autoScreened = articles.filter((a) => new Date(a.created_date) >= monthStart).length;

  const qcItems = triages.filter((t) => t.qc_sample);
  const qcReviewed = qcItems.filter((t) => decided.has(t.article)).length;

  const lastClosed = runs
    .filter((r) => r.status === "Closed")
    .sort((a, b) => new Date(b.date_range_end) - new Date(a.date_range_end))[0];
  const gaps = findRunGaps(runs);

  const activeStep = currentRun
    ? currentRun.status === "Closed"
      ? 5
      : currentRun.status === "Awaiting Review"
        ? 3
        : currentRun.status === "Running"
          ? 1
          : 2
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Weekly pharmacovigilance surveillance"
        title="This week's safety picture"
        description="Literature search, AI first-pass triage and Health Canada case clocks in one view. Every AI output is a suggestion until a qualified reviewer signs off."
        actions={
          gaps.length ? (
            <span className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[#DC2626]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {gaps.length} coverage gap{gaps.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Zero-gap verified
            </span>
          )
        }
      />

      {gaps.length > 0 && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-[12px] font-bold text-[#991B1B]">Search coverage gap</p>
          <p className="text-[11.5px] text-[#B91C1C]">
            {gaps.map((gap) => `${formatDate(gap.from)} → ${formatDate(gap.to)}`).join(", ")} is not covered. Start a run to
            close the gap.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-3">
          <RunProgressCard
            run={currentRun}
            pendingReview={queue.length}
            activeStep={activeStep}
            onResume={() => navigate({ to: "/review" })}
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2 lg:col-span-6">
          <DeadlinePanel cases={dueCases} />
          {previewArticles.length ? (
            <TriagePreviewList articles={previewArticles} />
          ) : (
            <section className="surface-card p-5">
              <p className="text-[13px] font-bold text-[#0F172A]">
                {isLoading ? "Loading the review queue…" : "Review queue clear"}
              </p>
              <p className="mt-1 text-[12px] text-[#64748B]">
                Every article has a human decision. Close the run to generate this week's search log.
              </p>
            </section>
          )}
        </div>
        <div className="order-3 lg:col-span-3">
          <MetricCards
            autoScreened={autoScreened}
            qcReviewed={qcReviewed}
            qcTotal={qcItems.length}
            lastRun={lastClosed?.date_range_end || ""}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-[#E2E8F0] bg-white/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => navigate({ to: "/review" })}
          className="w-full rounded-md bg-[#0D9488] px-3 py-3 text-[13px] font-semibold text-white"
        >
          Launch triage review ({queue.length} pending)
        </button>
      </div>
    </>
  );
}