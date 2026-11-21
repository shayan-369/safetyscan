import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import PageHeader from "@/components/pv/PageHeader";
import RunProgressCard from "@/components/dashboard/RunProgressCard";
import DeadlinePanel from "@/components/dashboard/DeadlinePanel";
import TriagePreviewList from "@/components/dashboard/TriagePreviewList";
import MetricCards from "@/components/dashboard/MetricCards";

export const Route = createFileRoute("/_authed/")({
  head: () => ({ meta: [{ title: "Dashboard · SafetyScan PV" }] }),
  component: Dashboard,
});

// Sample data while the live run pipeline is connected.
const SAMPLE_RUN = {
  date_range_start: "2026-11-15",
  date_range_end: "2026-11-21",
  status: "Awaiting Review",
  total_hits: 18,
  duplicates_removed: 2,
  ai_excluded: 9,
};

const SAMPLE_CASES = [
  {
    case_number: "PV-2026-0014",
    product: "Indocyanine Green kit",
    occurred_in: "Canada",
    due_date: "2026-11-24",
  },
  {
    case_number: "PV-2026-0015",
    product: "Drysol",
    occurred_in: "Foreign",
    due_date: "2026-11-27",
  },
];

const SAMPLE_ARTICLES = [
  {
    id: "a1",
    title: "Anaphylaxis following indocyanine green administration during fundus angiography",
    journal: "Canadian Journal of Ophthalmology",
    source_database: "PubMed",
    category: "Potential Reportable Case",
    brand_identified: "yes",
    confidence: 94,
  },
  {
    id: "a2",
    title: "Severe allergic contact dermatitis after aluminium chloride hexahydrate antiperspirant use",
    journal: "Contact Dermatitis",
    source_database: "PubMed",
    category: "Potential Reportable Case",
    brand_identified: "yes",
    confidence: 88,
  },
  {
    id: "a3",
    title: "Topical nifedipine and lidocaine for chronic anal fissure: a prospective cohort",
    journal: "Colorectal Disease",
    source_database: "Embase import",
    category: "Safety Information/Possible Signal",
    brand_identified: "yes",
    confidence: 81,
  },
];

function Dashboard() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Weekly pharmacovigilance surveillance"
        title="This week's safety picture"
        description="Literature search, AI first-pass triage and Health Canada case clocks in one view. Every AI output is a suggestion until a qualified reviewer signs off."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Zero-gap verified
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-3">
          <RunProgressCard
            run={SAMPLE_RUN}
            pendingReview={6}
            activeStep={3}
            onResume={() => navigate({ to: "/review" })}
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2 lg:col-span-6">
          <DeadlinePanel cases={SAMPLE_CASES} />
          <TriagePreviewList articles={SAMPLE_ARTICLES} />
        </div>
        <div className="order-3 lg:col-span-3">
          <MetricCards autoScreened={850} qcReviewed={3} qcTotal={5} lastRun="2026-11-14" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-[#E2E8F0] bg-white/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => navigate({ to: "/review" })}
          className="w-full rounded-md bg-[#0D9488] px-3 py-3 text-[13px] font-semibold text-white"
        >
          Launch triage review (6 pending)
        </button>
      </div>
    </>
  );
}