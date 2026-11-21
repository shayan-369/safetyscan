import { useEffect, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";

export default function ReactionCodingCard({ record, onSave, canWrite, busy }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const coded = record.reactions_coded?.length
      ? record.reactions_coded
      : (record.reactions || []).map((verbatim) => ({ verbatim, ai_pt: "", reviewer_pt: "", meddra_version: "", confirmed: false }));
    setRows(coded);
  }, [record.id, record.reactions_coded, record.reactions]);

  const update = (index, patch) =>
    setRows((prev) => prev.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0F172A]">Reaction coding</h2>
        {canWrite && (
          <button
            onClick={() => onSave(rows)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save coding
          </button>
        )}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.08em] text-[#64748B]">
              <th className="py-1.5 pr-2">Verbatim term</th>
              <th className="py-1.5 pr-2">AI MedDRA PT</th>
              <th className="py-1.5 pr-2">Reviewer PT</th>
              <th className="py-1.5 pr-2">MedDRA version</th>
              <th className="py-1.5">Confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {rows.map((row, index) => (
              <tr key={`${row.verbatim}-${index}`} className="align-top">
                <td className="py-1.5 pr-2 font-medium text-[#1E293B]">{row.verbatim}</td>
                <td className="py-1.5 pr-2">
                  <span className="text-[#475569]">{row.ai_pt || "—"}</span>
                  {row.ai_pt && (
                    <span className="mt-0.5 flex items-center gap-1 text-[9.5px] font-semibold text-amber-700">
                      <AlertTriangle className="h-2.5 w-2.5" /> unverified · confirm in licensed MedDRA browser
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.reviewer_pt || ""}
                    onChange={(event) => update(index, { reviewer_pt: event.target.value })}
                    disabled={!canWrite}
                    className="h-7 w-full rounded border border-[#E2E8F0] px-1.5 text-[11.5px] outline-none focus:border-[#0D9488]"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.meddra_version || ""}
                    onChange={(event) => update(index, { meddra_version: event.target.value })}
                    disabled={!canWrite}
                    placeholder="e.g. 27.0"
                    className="h-7 w-20 rounded border border-[#E2E8F0] px-1.5 text-[11.5px] outline-none focus:border-[#0D9488]"
                  />
                </td>
                <td className="py-1.5">
                  <input
                    type="checkbox"
                    checked={!!row.confirmed}
                    disabled={!canWrite}
                    onChange={(event) => update(index, { confirmed: event.target.checked })}
                    className="h-3.5 w-3.5 accent-[#0D9488]"
                  />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="py-3 text-[11px] text-[#94A3B8]">
                  No reactions recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}