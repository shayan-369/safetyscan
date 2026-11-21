import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { useQueueData } from "@/hooks/usePv";
import { decideArticle, retriageArticle } from "@/lib/server-fns";
import { markArticleInReview } from "@/lib/icsr-fns";
import { CATEGORY_ORDER, CATEGORY_TONE } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import ArticlePane from "@/components/review/ArticlePane";
import TriagePane from "@/components/review/TriagePane";
import FullTextCard from "@/components/review/FullTextCard";
import PatientsCard from "@/components/review/PatientsCard";
import NotOurProductDialog from "@/components/review/NotOurProductDialog";

export const Route = createFileRoute("/_authed/review")({
  head: () => ({ meta: [{ title: "Review queue · SafetyScan PV" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQueueData();
  const decideFn = useServerFn(decideArticle);
  const retriageFn = useServerFn(retriageArticle);
  const inReviewFn = useServerFn(markArticleInReview);

  const [handled, setHandled] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState("");
  const [overrideCategory, setOverrideCategory] = useState("Potential Reportable Case");
  const [overrideSignal, setOverrideSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notOurOpen, setNotOurOpen] = useState(false);

  const articles = data?.articles ?? [];
  const triages = data?.triages ?? [];
  const decisions = data?.decisions ?? [];
  const products = data?.products ?? [];

  const triageByArticle = useMemo(() => new Map(triages.map((t) => [t.article, t])), [triages]);

  const queue = useMemo(() => {
    const decided = new Set(decisions.map((d) => d.article));
    return articles
      .filter((a) => !a.duplicate_of && !decided.has(a.id) && !handled.includes(a.id))
      .filter((a) => {
        const triage = triageByArticle.get(a.id);
        if (!triage) return true;
        return triage.category !== "Not Relevant" || triage.qc_sample;
      })
      .sort((a, b) => {
        const ta = triageByArticle.get(a.id);
        const tb = triageByArticle.get(b.id);
        if (!ta) return -1;
        if (!tb) return 1;
        const order = CATEGORY_ORDER.indexOf(ta.category) - CATEGORY_ORDER.indexOf(tb.category);
        return order !== 0 ? order : (tb.confidence || 0) - (ta.confidence || 0);
      });
  }, [articles, triages, decisions, handled, triageByArticle]);

  const selected = queue.find((a) => a.id === selectedId) || queue[0] || null;
  const selectedTriage = selected ? triageByArticle.get(selected.id) : null;

  useEffect(() => {
    setComment("");
    setOverrideCategory(selectedTriage?.category || "Potential Reportable Case");
    if (selected?.id) {
      inReviewFn({ data: { articleId: selected.id } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["pv", "queue"] }))
        .catch(() => {});
    }
  }, [selected?.id, selectedTriage?.category]);

  const move = (direction) => {
    if (!queue.length) return;
    const index = queue.findIndex((a) => a.id === selected?.id);
    const next = queue[Math.min(queue.length - 1, Math.max(0, index + direction))];
    setSelectedId(next?.id ?? null);
  };

  const decide = async (decision, category, options = {}) => {
    if (!selected || !selectedTriage) {
      toast.error("Run the AI triage first.");
      return;
    }
    if (decision === "Override" && !options.notOurProduct && !comment.trim()) {
      toast.error("Add a comment explaining the override.");
      return;
    }
    setBusy(true);
    try {
      const result = await decideFn({
        data: {
          articleId: selected.id,
          decision,
          finalCategory: category,
          comment: comment.trim(),
          qcSample: !!selectedTriage.qc_sample,
          ...options,
        },
      });
      setHandled((prev) => [...prev, selected.id]);
      setNotOurOpen(false);
      const created = result.caseNumbers?.length || 0;
      toast.success(
        result.notOurProduct
          ? "Recorded as not our product with the exclusion reason"
          : created
            ? `Decision recorded · ${created} case${created === 1 ? "" : "s"} created, one per patient`
            : result.taskId
              ? "Follow-up task created: contact author for individual patient details"
              : "Decision recorded",
      );
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  };

  const retriage = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await retriageFn({ data: { articleId: selected.id } });
      toast.success("AI triage refreshed");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not re-run the AI triage.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (event.key === "j") {
        event.preventDefault();
        move(1);
      } else if (event.key === "k") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "c") {
        event.preventDefault();
        decide("Confirm AI", selectedTriage?.category);
      } else if (event.key === "o") {
        event.preventDefault();
        setOverrideSignal((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const counts = CATEGORY_ORDER.map((category) => ({
    category,
    count: queue.filter((a) => triageByArticle.get(a.id)?.category === category).length,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Human decision required"
        title="Review queue"
        description="Articles are ordered Potential Reportable Case first, then Safety Information, then AI exclusions selected for quality control. Every decision is recorded against your name."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {counts.map((entry) => (
              <StatusPill key={entry.category} tone={CATEGORY_TONE[entry.category] || "slate"}>
                {entry.count} {entry.category.replace("Safety Information/Possible Signal", "Safety info")}
              </StatusPill>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <p className="text-[13px] text-[#64748B]">Loading the queue…</p>
      ) : !queue.length ? (
        <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <ClipboardCheck className="h-8 w-8 text-[#0D9488]" />
          <p className="mt-3 text-[14px] font-bold text-[#0F172A]">Queue clear</p>
          <p className="mt-1 max-w-md text-[12px] text-[#64748B]">
            Every article in this run has a human decision and the quality-control sample is complete. The run can be closed
            from the search runs page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="surface-card overflow-hidden">
              <div className="border-b border-[#E2E8F0] px-3 py-2">
                <p className="label-caps">{queue.length} awaiting decision</p>
              </div>
              <ul className="max-h-[70vh] divide-y divide-[#E2E8F0] overflow-y-auto">
                {queue.map((article) => {
                  const triage = triageByArticle.get(article.id);
                  const active = article.id === selected?.id;
                  return (
                    <li key={article.id}>
                      <button
                        onClick={() => setSelectedId(article.id)}
                        className={`w-full px-3 py-2.5 text-left ${active ? "bg-teal-50/70" : "hover:bg-slate-50"}`}
                      >
                        <p className={`line-clamp-2 text-[11.5px] font-semibold ${active ? "text-[#0F766E]" : "text-[#0F172A]"}`}>
                          {article.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {triage ? (
                            <>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  triage.category === "Potential Reportable Case"
                                    ? "bg-[#DC2626]"
                                    : triage.category === "Not Relevant"
                                      ? "bg-slate-400"
                                      : "bg-amber-500"
                                }`}
                              />
                              <span className="text-[10px] text-[#64748B]">
                                {triage.confidence}% · {triage.seriousness}
                              </span>
                              {triage.qc_sample && <span className="text-[10px] font-bold text-amber-700">QC</span>}
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-700">Not triaged</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <ArticlePane article={selected} triage={selectedTriage} products={products} />
            <FullTextCard article={selected} onSaved={() => queryClient.invalidateQueries({ queryKey: ["pv"] })} />
          </div>

          <div className="space-y-4 lg:col-span-4">
            <TriagePane
              triage={selectedTriage}
              comment={comment}
              setComment={setComment}
              overrideCategory={overrideCategory}
              setOverrideCategory={setOverrideCategory}
              onDecide={decide}
              onRetriage={retriage}
              busy={busy}
              openOverrideSignal={overrideSignal}
            />
            <PatientsCard triage={selectedTriage} onNotOurProduct={() => setNotOurOpen(true)} />
          </div>
        </div>
      )}

      <NotOurProductDialog
        open={notOurOpen}
        onOpenChange={setNotOurOpen}
        busy={busy}
        onSubmit={(values) => decide("Override", "Not Relevant", { notOurProduct: true, ...values })}
      />
    </>
  );
}