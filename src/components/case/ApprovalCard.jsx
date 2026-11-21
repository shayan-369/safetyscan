import { useEffect, useState } from "react";
import { Ban, CheckCircle2, FileCheck2, Send } from "lucide-react";
import { formatDateTime, todayISO } from "@/lib/pv";
import StatusPill from "@/components/pv/StatusPill";

const METHODS = ["Electronic E2B", "Paper - fax", "Paper - mail"];

export default function ApprovalCard({
  record,
  canMedical,
  canWrite,
  onApprove,
  onSubmit,
  onFullText,
  busy,
}) {
  const [signature, setSignature] = useState("");
  const [qualification, setQualification] = useState("Pharmacist");
  const [confirmed, setConfirmed] = useState(false);
  const [method, setMethod] = useState(record.submission_method || "Electronic E2B");
  const [date, setDate] = useState(record.submitted_date || todayISO());
  const [ack, setAck] = useState(record.health_canada_ack || "");
  const [fullTextStatus, setFullTextStatus] = useState(record.full_text_status || "Not needed");
  const [exempt, setExempt] = useState(record.full_text_exempt_reason || "");

  useEffect(() => {
    setFullTextStatus(record.full_text_status || "Not needed");
    setExempt(record.full_text_exempt_reason || "");
    setMethod(record.submission_method || "Electronic E2B");
    setDate(record.submitted_date || todayISO());
    setAck(record.health_canada_ack || "");
  }, [record.id, record.full_text_status, record.submission_method, record.submitted_date, record.health_canada_ack]);

  const fullTextReady = record.full_text_status === "Received" || !!record.full_text_exempt_reason?.trim();

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0F172A]">Full text, approval and submission</h2>
        <StatusPill tone={record.status === "Approved" ? "teal" : record.status === "Submitted" ? "purple" : "slate"}>
          {record.status}
        </StatusPill>
      </div>

      <div className="mt-2 space-y-1.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2">
        <p className="label-caps">Full text</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={fullTextStatus}
            onChange={(event) => setFullTextStatus(event.target.value)}
            disabled={!canWrite}
            className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
          >
            <option>Not needed</option>
            <option>Requested</option>
            <option>Received</option>
          </select>
          <button
            onClick={() => onFullText({ status: fullTextStatus, exemptReason: exempt })}
            disabled={!canWrite || busy}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#1E293B] disabled:opacity-50"
          >
            Save full text
          </button>
        </div>
        <input
          value={exempt}
          onChange={(event) => setExempt(event.target.value)}
          disabled={!canWrite}
          placeholder="Reason if the full text cannot be obtained"
          className="h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
        />
        {!fullTextReady && (
          <p className="text-[10.5px] font-semibold text-amber-700">
            A case cannot be approved until the full text is Received or a reason is recorded.
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-[#E2E8F0] pt-2">
        <p className="label-caps">Medical Reviewer approval</p>
        {record.approved_by ? (
          <p className="mt-1 flex items-start gap-1.5 text-[11px] text-[#0F766E]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Signed by {record.approved_by} ({record.approved_role}) on {formatDateTime(record.approved_at)}. Electronic
            signature stored with name, role and timestamp.
          </p>
        ) : canMedical ? (
          <div className="mt-1 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                placeholder="Type your full name"
                className="h-8 rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
              />
              <select
                value={qualification}
                onChange={(event) => setQualification(event.target.value)}
                className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
              >
                <option>Physician</option>
                <option>Pharmacist</option>
                <option>Nurse</option>
                <option>Other</option>
              </select>
            </div>
            <label className="flex items-start gap-1.5 text-[10.5px] text-[#475569]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[#0D9488]"
              />
              I confirm this medical assessment
            </label>
            <button
              onClick={() => onApprove({ signatureName: signature, qualification, confirmed })}
              disabled={busy || !confirmed || signature.trim().length < 2 || !fullTextReady}
              className="inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <FileCheck2 className="h-3 w-3" /> Approve case
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-[#64748B]">Only a Medical Reviewer can approve this case.</p>
        )}
      </div>

      <div className="mt-3 border-t border-[#E2E8F0] pt-2">
        <p className="label-caps">Submission to Health Canada</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            disabled={!canWrite}
            className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
          >
            {METHODS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={!canWrite}
            className="h-8 rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
          />
        </div>
        <input
          value={ack}
          onChange={(event) => setAck(event.target.value)}
          disabled={!canWrite}
          placeholder="Health Canada acknowledgement or AER number"
          className="mt-1.5 h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
        />
        <button
          onClick={() => onSubmit({ method, date, acknowledgement: ack })}
          disabled={!canWrite || busy || record.status !== "Approved"}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-3 w-3" /> Record submission
        </button>
        {record.status !== "Approved" && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[#94A3B8]">
            <Ban className="h-3 w-3" /> Submission is blocked until the case is approved.
          </p>
        )}
        <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-900">
          Reports must not be sent to Health Canada by email. Use the regulated electronic or paper channel.
        </p>
      </div>
    </section>
  );
}