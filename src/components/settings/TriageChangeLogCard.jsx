import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { GitCompareArrows, Plus } from "lucide-react";
import { useChangeLogs } from "@/hooks/usePv";
import { approveTriageChange, requestTriageChange } from "@/lib/icsr-fns";
import { formatDateTime } from "@/lib/pv";
import StatusPill from "@/components/pv/StatusPill";

const AREAS = ["Triage prompt", "Confidence threshold", "AI model", "Search frequency"];

export default function TriageChangeLogCard({ canWrite, canMedical }) {
  const { data: changes = [] } = useChangeLogs();
  const requestFn = useServerFn(requestTriageChange);
  const approveFn = useServerFn(approveTriageChange);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ area: "Triage prompt", change: "", reason: "" });
  const [signature, setSignature] = useState("");

  const request = async () => {
    setBusy(true);
    try {
      await requestFn({ data: form });
      toast.success("Change requested · a Medical Reviewer must approve it");
      setOpen(false);
      setForm({ area: "Triage prompt", change: "", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not record the change.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id) => {
    setBusy(true);
    try {
      await approveFn({ data: { id, signatureName: signature } });
      toast.success("Change approved by the Medical Reviewer");
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not approve the change.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
            <GitCompareArrows className="h-4 w-4 text-[#0D9488]" /> Triage change control
          </h2>
          <p className="text-[10.5px] text-[#64748B]">
            Changing the triage prompt, the confidence threshold or the AI model needs a written reason and Medical Reviewer
            approval.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#1E293B]"
          >
            <Plus className="h-3 w-3" /> Request change
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps">Area</span>
            <select
              value={form.area}
              onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
            >
              {AREAS.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-caps">Change</span>
            <input
              value={form.change}
              onChange={(event) => setForm((prev) => ({ ...prev, change: event.target.value }))}
              placeholder="e.g. add special situations to the prompt"
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-caps">Reason</span>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              rows={2}
              className="mt-0.5 w-full rounded border border-[#E2E8F0] p-2 text-[11.5px]"
            />
          </label>
          <button
            onClick={request}
            disabled={busy || form.change.trim().length < 2 || form.reason.trim().length < 5}
            className="rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Submit for approval
          </button>
        </div>
      )}

      {canMedical && (
        <input
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder="Medical Reviewer name for approvals"
          className="mt-2 h-8 w-full max-w-xs rounded border border-[#E2E8F0] px-2 text-[11.5px]"
        />
      )}

      <ul className="mt-2 divide-y divide-[#E2E8F0]">
        {changes.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold text-[#0F172A]">
                {entry.area} · {entry.change}
              </p>
              <p className="text-[10.5px] text-[#64748B]">
                {entry.reason} · requested by {entry.requested_by}
                {entry.approved_by ? ` · approved by ${entry.approved_by} on ${formatDateTime(entry.approved_at)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusPill tone={entry.status === "Approved" ? "green" : "amber"}>{entry.status}</StatusPill>
              {canMedical && entry.status === "Pending approval" && (
                <button
                  onClick={() => approve(entry.id)}
                  disabled={busy || signature.trim().length < 2}
                  className="rounded border border-[#0D9488] px-2 py-0.5 text-[10.5px] font-semibold text-[#0D9488] disabled:opacity-50"
                >
                  Approve
                </button>
              )}
            </div>
          </li>
        ))}
        {!changes.length && <li className="py-2 text-[11px] text-[#94A3B8]">No triage changes recorded.</li>}
      </ul>
    </section>
  );
}