import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, XCircle } from "lucide-react";
import { useValidationRuns } from "@/hooks/usePv";
import { runValidation } from "@/lib/icsr-fns";
import { formatDateTime } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";

export const Route = createFileRoute("/_authed/validation")({
  head: () => ({ meta: [{ title: "AI validation · SafetyScan PV" }] }),
  component: ValidationPage,
});

function parseResults(value) {
  try {
    return JSON.parse(value || "[]");
  } catch (error) {
    return [];
  }
}

function ValidationPage() {
  const queryClient = useQueryClient();
  const { data: runs = [] } = useValidationRuns();
  const validateFn = useServerFn(runValidation);
  const [busy, setBusy] = useState(false);

  const latest = runs[0] || null;
  const results = latest ? parseResults(latest.results) : [];

  const runNow = async () => {
    setBusy(true);
    try {
      const result = await validateFn({});
      toast.success(`Validation complete · ${result.run.accuracy}% of fields matched the expected results`);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not run the validation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="System control"
        title="AI validation"
        description="The fixed test set of sample articles is re-triaged with the current prompt and model. Every expected field is compared with the AI output, and the AI-versus-human agreement and override rates come from the review decisions on record."
        actions={
          <button
            onClick={runNow}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> {busy ? "Running…" : "Run validation"}
          </button>
        }
      />

      {!latest ? (
        <div className="surface-card px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-[#0F172A]">No validation run yet</p>
          <p className="mt-1 text-[12px] text-[#64748B]">Run the suite to score the AI against the fixed test set.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Overall accuracy", value: `${latest.accuracy}%`, tone: latest.accuracy >= 90 ? "green" : "amber" },
              { label: "Fields passed", value: `${latest.passed_fields}/${latest.total_fields}`, tone: "slate" },
              { label: "AI vs human agreement", value: `${latest.agreement_rate}%`, tone: "teal" },
              { label: "Override rate", value: `${latest.override_rate}%`, tone: "amber" },
            ].map((metric) => (
              <div key={metric.label} className="surface-card p-3">
                <p className="label-caps">{metric.label}</p>
                <p className="mt-1 text-[20px] font-bold tabular-nums text-[#0F172A]">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Per-field results</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone="slate">Prompt {latest.prompt_version}</StatusPill>
                <StatusPill tone="teal">{latest.ai_model}</StatusPill>
                <span className="text-[10.5px] text-[#64748B]">
                  {formatDateTime(latest.run_date)} · {latest.performed_by}
                </span>
              </div>
            </div>

            <div className="mt-2 space-y-3">
              {results.map((entry) => (
                <div key={entry.title} className="rounded border border-[#E2E8F0] p-2">
                  <p className="text-[11.5px] font-semibold text-[#1E293B]">{entry.title}</p>
                  <ul className="mt-1 space-y-0.5">
                    {entry.checks.map((check) => (
                      <li key={check.field} className="flex items-center gap-1.5 text-[10.5px]">
                        {check.pass ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-[#DC2626]" />
                        )}
                        <span className="font-semibold text-[#475569]">{check.field}</span>
                        <span className="text-[#64748B]">
                          expected {String(check.expected)} · got {String(check.actual)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!results.length && <p className="text-[11px] text-[#94A3B8]">No matching test articles were found.</p>}
            </div>
          </div>

          {runs.length > 1 && (
            <div className="surface-card p-4">
              <h2 className="text-[13px] font-bold text-[#0F172A]">Run history</h2>
              <ul className="mt-2 divide-y divide-[#E2E8F0]">
                {runs.map((run) => (
                  <li key={run.id} className="flex items-center justify-between py-1.5 text-[11px]">
                    <span className="text-[#475569]">{formatDateTime(run.run_date)}</span>
                    <span className="font-semibold text-[#0F172A]">
                      {run.accuracy}% · prompt {run.prompt_version}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}