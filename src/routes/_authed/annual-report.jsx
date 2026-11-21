import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpenCheck, Download, FileSignature } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAnnualReports, useCases, useProducts, useSignals } from "@/hooks/usePv";
import { buildAnnualReport, signAnnualReport } from "@/lib/icsr-fns";
import { formatDate, pvRoleOf, todayISO } from "@/lib/pv";
import { downloadAnnualReport } from "@/lib/report-pdf";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import AiSuggestionBadge from "@/components/pv/AiSuggestionBadge";

export const Route = createFileRoute("/_authed/annual-report")({
  head: () => ({ meta: [{ title: "Annual Summary Report · SafetyScan PV" }] }),
  component: AnnualReportPage,
});

function AnnualReportPage() {
  const { user } = useAuth();
  const role = pvRoleOf(user);
  const canWrite = role !== "Inspector";
  const canMedical = ["Medical Reviewer", "Admin"].includes(role);
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: reports = [] } = useAnnualReports();
  const { data: cases = [] } = useCases();
  const { data: signals = [] } = useSignals();
  const buildFn = useServerFn(buildAnnualReport);
  const signFn = useServerFn(signAnnualReport);

  const [productId, setProductId] = useState("");
  const [lockPoint, setLockPoint] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState("");
  const [significantChange, setSignificantChange] = useState("no");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    if (productId || !products.length) return;
    const first = products[0];
    setProductId(first.id);
    setLockPoint(first.data_lock_point || todayISO());
  }, [products.length]);

  const product = products.find((entry) => entry.id === productId) || null;
  const report = useMemo(
    () => reports.find((entry) => entry.product === productId) || null,
    [reports, productId],
  );
  const productCases = cases.filter((record) => record.product === productId);
  const productSignals = signals.filter((signal) => signal.product === productId);

  const build = async () => {
    setBusy(true);
    try {
      await buildFn({ data: { productId, lockPoint } });
      toast.success("Annual Summary Report data collected and the critical analysis drafted by AI");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not build the report.");
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    setBusy(true);
    try {
      await signFn({ data: { id: report.id, significantChange, rationale, signatureName: signature } });
      toast.success(
        significantChange === "yes"
          ? "Report signed · task created to notify Health Canada without delay"
          : "Report signed by the Medical Reviewer",
      );
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not sign the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Periodic reporting"
        title="Annual Summary Report"
        description="A 12-month period per product, counted back from the product's data lock point with no gaps. Cases, literature findings, signals and special situations are collected automatically; the critical analysis is an AI draft until a Medical Reviewer signs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                const next = products.find((entry) => entry.id === event.target.value);
                setLockPoint(next?.data_lock_point || todayISO());
              }}
              className="h-9 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px] font-medium"
            >
              {products.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.brand_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={lockPoint}
              onChange={(event) => setLockPoint(event.target.value)}
              className="h-9 rounded-md border border-[#E2E8F0] px-2 text-[12px]"
            />
            {canWrite && (
              <button
                onClick={build}
                disabled={busy || !productId}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                <BookOpenCheck className="h-3.5 w-3.5" /> {busy ? "Working…" : "Build report"}
              </button>
            )}
          </div>
        }
      />

      {!report ? (
        <div className="surface-card px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-[#0F172A]">No report for {product?.brand_name || "this product"} yet</p>
          <p className="mt-1 text-[12px] text-[#64748B]">
            Set the data lock point and build the report. {productCases.length} case{productCases.length === 1 ? "" : "s"} and{" "}
            {productSignals.length} signal{productSignals.length === 1 ? "" : "s"} are on record for this product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <section className="surface-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[13px] font-bold text-[#0F172A]">{report.product_name}</h2>
                  <p className="text-[11px] text-[#64748B]">
                    {formatDate(report.period_start)} to {formatDate(report.period_end)} · due{" "}
                    {formatDate(report.due_date)} (70 days after the data lock point)
                  </p>
                </div>
                <StatusPill tone={report.status === "Signed" ? "green" : "amber"}>{report.status}</StatusPill>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border border-[#E2E8F0] px-2 py-1.5">
                  <p className="label-caps">Cases</p>
                  <p className="font-bold text-[#0F172A]">{(report.line_listing || "").split("\n").filter(Boolean).length}</p>
                </div>
                <div className="rounded border border-[#E2E8F0] px-2 py-1.5">
                  <p className="label-caps">Signals</p>
                  <p className="font-bold text-[#0F172A]">{(report.signals_summary || "").split("\n").filter(Boolean).length}</p>
                </div>
                <div className="rounded border border-[#E2E8F0] px-2 py-1.5">
                  <p className="label-caps">Special situations</p>
                  <p className="font-bold text-[#0F172A]">{(report.special_situations_summary || "").split(",").filter(Boolean).length}</p>
                </div>
              </div>
            </section>

            <section className="surface-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-bold text-[#0F172A]">Critical analysis</h2>
                <AiSuggestionBadge compact />
              </div>
              <p className="mt-2 whitespace-pre-line text-[12px] leading-6 text-[#1E293B]">{report.critical_analysis || "Not drafted."}</p>
            </section>

            <section className="surface-card p-4">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Line listing</h2>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[10.5px] leading-5 text-[#475569]">
                {report.line_listing || "No cases in the period."}
              </pre>
              <h3 className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B]">Significant literature findings</h3>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[10.5px] leading-5 text-[#475569]">
                {report.literature_findings || "None recorded."}
              </pre>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <section className="surface-card p-4">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Medical Reviewer conclusion</h2>
              {report.signed_by ? (
                <div className="mt-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2 text-[11.5px] text-[#475569]">
                  <p>
                    Significant change in benefit-risk: <span className="font-bold">{report.significant_change}</span>
                  </p>
                  <p className="mt-1">{report.rationale}</p>
                  <p className="mt-1 text-[10.5px] text-[#64748B]">
                    Signed {report.signed_by} ({report.signed_role}) · {formatDate(report.signed_at)}
                  </p>
                </div>
              ) : canMedical ? (
                <div className="mt-2 space-y-2">
                  <select
                    value={significantChange}
                    onChange={(event) => setSignificantChange(event.target.value)}
                    className="h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
                  >
                    <option value="no">No significant change in benefit-risk</option>
                    <option value="yes">Yes, significant change (notify Health Canada)</option>
                  </select>
                  <textarea
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    rows={3}
                    placeholder="Rationale for the conclusion (required)"
                    className="w-full rounded border border-[#E2E8F0] p-2 text-[11.5px]"
                  />
                  <input
                    value={signature}
                    onChange={(event) => setSignature(event.target.value)}
                    placeholder="Type your full name as the electronic signature"
                    className="h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px]"
                  />
                  <button
                    onClick={sign}
                    disabled={busy || rationale.trim().length < 10 || signature.trim().length < 2}
                    className="inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <FileSignature className="h-3 w-3" /> Sign report
                  </button>
                  <p className="text-[10px] text-[#94A3B8]">
                    Answering yes creates the task "Notify Health Canada without delay".
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[#64748B]">Only a Medical Reviewer can conclude on significant change.</p>
              )}
            </section>

            <section className="surface-card p-4">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Export</h2>
              <button
                onClick={() => downloadAnnualReport({ report, cases: productCases })}
                className="mt-2 inline-flex items-center gap-1.5 rounded bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" /> Annual Summary Report PDF
              </button>
            </section>
          </div>
        </div>
      )}
    </>
  );
}