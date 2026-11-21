import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Globe2, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useForeignActions, useProducts } from "@/hooks/usePv";
import { decideForeignAction, saveForeignAction, summarizeNotice } from "@/lib/icsr-fns";
import { formatDate, pvRoleOf, todayISO } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";

export const Route = createFileRoute("/_authed/foreign-actions")({
  head: () => ({ meta: [{ title: "Foreign actions · SafetyScan PV" }] }),
  component: ForeignActionsPage,
});

const AUTHORITIES = ["FDA", "EMA", "MHRA", "Health Canada", "TGA", "Swissmedic", "Other regulator"];

function hoursLeft(date) {
  if (!date) return null;
  return Math.round((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 3600000);
}

function Deadline({ date }) {
  const hours = hoursLeft(date);
  if (hours == null) return <span className="text-[10.5px] text-[#94A3B8]">No deadline</span>;
  const overdue = hours < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${
        overdue ? "bg-red-100 text-[#B91C1C]" : "bg-red-50 text-[#DC2626]"
      }`}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {overdue ? `${Math.abs(hours)}h overdue` : `${hours}h left`} · {formatDate(date)}
    </span>
  );
}

function ForeignActionsPage() {
  const { user } = useAuth();
  const role = pvRoleOf(user);
  const canWrite = role !== "Inspector";
  const canMedical = ["Medical Reviewer", "Admin"].includes(role);
  const queryClient = useQueryClient();
  const { data: actions = [] } = useForeignActions();
  const { data: products = [] } = useProducts();
  const saveFn = useServerFn(saveForeignAction);
  const summarizeFn = useServerFn(summarizeNotice);
  const decideFn = useServerFn(decideForeignAction);

  const prescription = products.filter((product) => product.product_type === "Drug");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    authority: "FDA",
    awarenessDate: todayISO(),
    product: "",
    summary: "",
    noticeText: "",
  });
  const [decision, setDecision] = useState({});

  useEffect(() => {
    if (!form.product && prescription[0]) setForm((prev) => ({ ...prev, product: prescription[0].id }));
  }, [prescription.length]);

  const summarise = async () => {
    setBusy(true);
    try {
      const result = await summarizeFn({
        data: { authority: form.authority, productName: products.find((p) => p.id === form.product)?.brand_name || "", text: form.noticeText },
      });
      setForm((prev) => ({ ...prev, summary: result.summary }));
      toast.success("Notice summarised by AI. Review the wording before saving.");
    } catch (error) {
      toast.error(error?.message || "Could not summarise the notice.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveFn({ data: { ...form } });
      toast.success("Foreign action recorded with a 72-hour clock");
      setOpen(false);
      setForm((prev) => ({ ...prev, summary: "", noticeText: "" }));
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the foreign action.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (action) => {
    const entry = decision[action.id] || {};
    setBusy(true);
    try {
      await decideFn({
        data: {
          id: action.id,
          seriousRisk: entry.seriousRisk || "unclear",
          rationale: entry.rationale || "",
          notifiedDate: entry.notifiedDate || "",
        },
      });
      toast.success("Relevance decision recorded");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  };

  const setEntry = (id, patch) => setDecision((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  return (
    <>
      <PageHeader
        eyebrow="Environmental scanning"
        title="Foreign regulatory actions"
        description="Actions taken by another authority on our prescription products. Awareness plus 72 hours is the internal deadline to decide whether the action signals a serious risk of injury relevant to Canada."
        actions={
          canWrite && (
            <button
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Record action
            </button>
          )
        }
      />

      {open && (
        <section className="surface-card mb-4 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="label-caps">Authority</span>
              <select
                value={form.authority}
                onChange={(event) => setForm((prev) => ({ ...prev, authority: event.target.value }))}
                className="mt-0.5 h-9 w-full rounded border border-[#E2E8F0] bg-white px-2 text-[12px]"
              >
                {AUTHORITIES.map((authority) => (
                  <option key={authority}>{authority}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-caps">Date we became aware</span>
              <input
                type="date"
                value={form.awarenessDate}
                onChange={(event) => setForm((prev) => ({ ...prev, awarenessDate: event.target.value }))}
                className="mt-0.5 h-9 w-full rounded border border-[#E2E8F0] px-2 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="label-caps">Product</span>
              <select
                value={form.product}
                onChange={(event) => setForm((prev) => ({ ...prev, product: event.target.value }))}
                className="mt-0.5 h-9 w-full rounded border border-[#E2E8F0] bg-white px-2 text-[12px]"
              >
                {prescription.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.brand_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className="label-caps">Paste the notice</span>
            <textarea
              value={form.noticeText}
              onChange={(event) => setForm((prev) => ({ ...prev, noticeText: event.target.value }))}
              rows={3}
              placeholder="Paste the regulator's notice and let the AI summarise it"
              className="mt-0.5 w-full rounded border border-[#E2E8F0] p-2 text-[12px]"
            />
          </label>
          <button
            onClick={summarise}
            disabled={busy || form.noticeText.trim().length < 20}
            className="mt-1 inline-flex items-center gap-1.5 rounded border border-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-[#0D9488] disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" /> Summarise with AI
          </button>
          <label className="mt-2 block">
            <span className="label-caps">Summary (AI suggestion - requires review)</span>
            <textarea
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              rows={3}
              className="mt-0.5 w-full rounded border border-[#E2E8F0] p-2 text-[12px]"
            />
          </label>
          <button
            onClick={save}
            disabled={busy || form.summary.trim().length < 5 || !form.product}
            className="mt-2 rounded bg-[#0F172A] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Save foreign action
          </button>
        </section>
      )}

      <div className="space-y-3">
        {actions.map((action) => (
          <section key={action.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
                  <Globe2 className="h-3.5 w-3.5 text-[#0D9488]" /> {action.authority} · {action.product_name}
                </p>
                <p className="text-[10.5px] text-[#64748B]">
                  Aware {formatDate(action.awareness_date)}
                  {action.notified_date ? ` · Health Canada notified ${formatDate(action.notified_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusPill tone={action.status === "Notified" ? "green" : "red"}>{action.status}</StatusPill>
                {action.status !== "Notified" && <Deadline date={action.due_date} />}
              </div>
            </div>

            <p className="mt-2 text-[12px] leading-5 text-[#1E293B]">{action.summary}</p>

            {action.serious_risk_to_canada && (
              <p className="mt-2 rounded bg-[#F8FAFC] px-2 py-1.5 text-[11px] text-[#475569]">
                Serious risk of injury relevant to Canada: <span className="font-semibold">{action.serious_risk_to_canada}</span>
                {action.relevance_rationale ? ` · ${action.relevance_rationale}` : ""}
                {action.relevance_decided_by ? ` · decided by ${action.relevance_decided_by}` : ""}
              </p>
            )}

            {canMedical && action.status !== "Notified" && (
              <div className="mt-2 grid grid-cols-1 gap-1.5 border-t border-[#E2E8F0] pt-2 sm:grid-cols-4">
                <select
                  value={decision[action.id]?.seriousRisk || "unclear"}
                  onChange={(event) => setEntry(action.id, { seriousRisk: event.target.value })}
                  className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
                >
                  <option value="yes">Serious risk: yes</option>
                  <option value="no">Serious risk: no</option>
                  <option value="unclear">Serious risk: unclear</option>
                </select>
                <input
                  value={decision[action.id]?.rationale || ""}
                  onChange={(event) => setEntry(action.id, { rationale: event.target.value })}
                  placeholder="Rationale (required)"
                  className="h-8 rounded border border-[#E2E8F0] px-1.5 text-[11.5px] sm:col-span-2"
                />
                <input
                  type="date"
                  value={decision[action.id]?.notifiedDate || ""}
                  onChange={(event) => setEntry(action.id, { notifiedDate: event.target.value })}
                  className="h-8 rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
                />
                <button
                  onClick={() => decide(action)}
                  disabled={busy || (decision[action.id]?.rationale || "").trim().length < 5}
                  className="rounded bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-4"
                >
                  Save Medical Reviewer decision
                </button>
              </div>
            )}
          </section>
        ))}
        {!actions.length && (
          <p className="surface-card px-4 py-8 text-center text-[12px] text-[#64748B]">No foreign regulatory actions recorded.</p>
        )}
      </div>
    </>
  );
}