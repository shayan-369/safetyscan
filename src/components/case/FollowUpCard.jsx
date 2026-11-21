import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { createFollowUp } from "@/lib/icsr-fns";
import { FOLLOWUP_TYPES, formatDate, todayISO } from "@/lib/pv";
import StatusPill from "@/components/pv/StatusPill";

const OUTCOMES = ["Awaiting reply", "Received", "No reply", "Refused", "Closed"];

export default function FollowUpCard({ record, followUps = [], canWrite, versions = [] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    type: "Author contact",
    dateRequested: todayISO(),
    method: "",
    sentTo: "",
    responseDate: "",
    outcome: "Awaiting reply",
    significantNewInfo: "no",
    notes: "",
    receivedDate: "",
  });
  const queryClient = useQueryClient();
  const submit = useServerFn(createFollowUp);

  const save = async () => {
    setBusy(true);
    try {
      const result = await submit({ data: { caseId: record.id, ...form } });
      toast.success(
        result.newVersionId
          ? `Significant new information recorded · case version ${result.version} created and the 15-day clock restarted`
          : "Follow-up attempt logged",
      );
      setOpen(false);
      setForm((prev) => ({ ...prev, notes: "", sentTo: "", method: "", responseDate: "" }));
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not log the follow-up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-[#0F172A]">Follow-up attempts</h2>
          <p className="text-[10.5px] text-[#64748B]">Every attempt is logged, even when there is no reply.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#1E293B]"
          >
            <Plus className="h-3 w-3" /> Log follow-up
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label-caps">Type</span>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
              >
                {FOLLOWUP_TYPES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-caps">Date requested</span>
              <input
                type="date"
                value={form.dateRequested}
                onChange={(event) => setForm((prev) => ({ ...prev, dateRequested: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
              />
            </label>
            <label className="block">
              <span className="label-caps">Method</span>
              <input
                value={form.method}
                onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
                placeholder="Email, journal form…"
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
              />
            </label>
            <label className="block">
              <span className="label-caps">Sent to</span>
              <input
                value={form.sentTo}
                onChange={(event) => setForm((prev) => ({ ...prev, sentTo: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
              />
            </label>
            <label className="block">
              <span className="label-caps">Response date</span>
              <input
                type="date"
                value={form.responseDate}
                onChange={(event) => setForm((prev) => ({ ...prev, responseDate: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
              />
            </label>
            <label className="block">
              <span className="label-caps">Outcome</span>
              <select
                value={form.outcome}
                onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
              >
                {OUTCOMES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label-caps">Significant new information</span>
            <select
              value={form.significantNewInfo}
              onChange={(event) => setForm((prev) => ({ ...prev, significantNewInfo: event.target.value }))}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
            >
              <option value="no">No</option>
              <option value="yes">Yes, create a new case version and restart the clock</option>
            </select>
          </label>
          {form.significantNewInfo === "yes" && (
            <label className="block">
              <span className="label-caps">New version received date</span>
              <input
                type="date"
                value={form.receivedDate}
                onChange={(event) => setForm((prev) => ({ ...prev, receivedDate: event.target.value }))}
                className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
              />
            </label>
          )}
          <textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            rows={2}
            placeholder="What was requested and what came back"
            className="w-full rounded border border-[#E2E8F0] p-2 text-[11.5px]"
          />
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save follow-up"}
          </button>
        </div>
      )}

      <ul className="mt-2 divide-y divide-[#E2E8F0]">
        {followUps.map((entry) => (
          <li key={entry.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-[11.5px] font-semibold text-[#1E293B]">
                {entry.type} · {formatDate(entry.date_requested)}
              </p>
              <div className="flex items-center gap-1">
                <StatusPill tone={entry.outcome === "Received" ? "green" : entry.outcome === "No reply" ? "red" : "amber"}>
                  {entry.outcome}
                </StatusPill>
                {entry.significant_new_info === "yes" && <StatusPill tone="red">New version</StatusPill>}
              </div>
            </div>
            <p className="text-[10.5px] text-[#64748B]">
              {[entry.method, entry.sent_to].filter(Boolean).join(" · ") || "Method not recorded"}
              {entry.response_date ? ` · replied ${formatDate(entry.response_date)}` : ""} · logged by {entry.logged_by}
            </p>
            {entry.notes && <p className="mt-0.5 text-[11px] text-[#475569]">{entry.notes}</p>}
          </li>
        ))}
        {!followUps.length && <li className="py-2 text-[11px] text-[#94A3B8]">No follow-up attempts logged yet.</li>}
      </ul>

      {versions.length > 1 && (
        <div className="mt-2 border-t border-[#E2E8F0] pt-2">
          <p className="label-caps">Case versions</p>
          <ul className="mt-1 space-y-0.5">
            {versions.map((version) => (
              <li key={version.id} className="text-[11px] text-[#475569]">
                v{version.version || 1} · received {formatDate(version.received_date || version.day_zero)} ·{" "}
                {version.id === record.id ? "this version" : version.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}