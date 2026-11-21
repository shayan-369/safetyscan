import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { useAuditLogs } from "@/hooks/usePv";
import { formatDateTime } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";

export const Route = createFileRoute("/_authed/audit")({
  head: () => ({ meta: [{ title: "Audit trail · SafetyScan PV" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data: logs = [], isLoading } = useAuditLogs();
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("All");
  const [expanded, setExpanded] = useState(null);

  const entities = useMemo(() => ["All", ...new Set(logs.map((log) => log.entity).filter(Boolean))], [logs]);

  const filtered = logs.filter((log) => {
    const matchesEntity = entity === "All" || log.entity === entity;
    const text = `${log.who} ${log.action} ${log.entity} ${log.entity_id}`.toLowerCase();
    return matchesEntity && (!query || text.includes(query.toLowerCase()));
  });

  return (
    <>
      <PageHeader
        eyebrow="Inspection readiness"
        title="Audit trail"
        description="Every search, AI triage, review decision and case change is recorded. Entries can never be edited or deleted."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
            <Lock className="h-3 w-3" /> Immutable · read only
          </span>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by person, action or record"
          className="h-9 flex-1 rounded-md border border-[#E2E8F0] bg-white px-3 text-[12px] outline-none focus:border-[#0D9488]"
        />
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="h-9 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px]"
        >
          {entities.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="cursor-pointer align-top text-[12px] hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-[#64748B]">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0F172A]">{log.who}</td>
                  <td className="px-4 py-2.5 text-[#1E293B]">
                    {log.action}
                    {expanded === log.id && (log.before || log.after) && (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {log.before && (
                          <pre className="max-h-40 overflow-auto rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2 font-mono text-[10px] text-[#475569]">
                            {log.before}
                          </pre>
                        )}
                        {log.after && (
                          <pre className="max-h-40 overflow-auto rounded border border-teal-200 bg-teal-50/50 p-2 font-mono text-[10px] text-[#0F766E]">
                            {log.after}
                          </pre>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-[#64748B]">{log.entity}</td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-[#94A3B8]">{log.entity_id?.slice(0, 12)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[12px] text-[#64748B]">
                    {isLoading ? "Loading the audit trail…" : "No audit entries match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}