import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Activity } from "lucide-react";
import { useCases, useQueueData } from "@/hooks/usePv";
import { formatDate } from "@/lib/pv";
import PageHeader from "@/components/pv/PageHeader";

export const Route = createFileRoute("/_authed/signals")({
  head: () => ({ meta: [{ title: "Signals · SafetyScan PV" }] }),
  component: SignalsPage,
});

const SERIES = [
  { key: "series0", color: "#0D9488" },
  { key: "series1", color: "#0F172A" },
  { key: "series2", color: "#D97706" },
  { key: "series3", color: "#DC2626" },
  { key: "series4", color: "#64748B" },
];

function monthKey(value) {
  const d = new Date(value || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-CA", { month: "short" });
}

function SignalsPage() {
  const { data: cases = [] } = useCases();
  const { data } = useQueueData();
  const triages = data?.triages ?? [];
  const articles = data?.articles ?? [];
  const [productName, setProductName] = useState("All products");

  const productById = useMemo(
    () => new Map((data?.products ?? []).map((product) => [product.id, product.brand_name])),
    [data],
  );

  const events = useMemo(() => {
    const confirmed = cases.map((record) => ({
      product: record.product_name || "Unmatched product",
      reactions: record.reactions || [],
      date: record.day_zero || record.created_date,
      expectedness: record.expectedness,
    }));
    const caseArticles = new Set(cases.map((record) => record.article).filter(Boolean));
    const signalArticles = articles
      .filter((article) => !article.duplicate_of && !caseArticles.has(article.id))
      .map((article) => {
        const triage = triages.find((t) => t.article === article.id);
        if (!triage || triage.category === "Not Relevant") return null;
        const productName = (article.matched_products || []).map((id) => productById.get(id)).filter(Boolean)[0];
        return {
          product: productName || "Unmatched product",
          reactions: triage.reactions || [],
          date: article.publication_date || article.created_date,
          expectedness: triage.expectedness,
        };
      })
      .filter(Boolean);
    return [...confirmed, ...signalArticles];
  }, [cases, articles, triages, productById]);

  const products = useMemo(
    () => ["All products", ...new Set(events.map((e) => e.product))],
    [events],
  );

  const scoped = productName === "All products" ? events : events.filter((e) => e.product === productName);

  const { chartData, seriesKeys } = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const totals = new Map();
    scoped.forEach((event) => {
      (event.reactions || []).forEach((reaction) => {
        totals.set(reaction, (totals.get(reaction) || 0) + 1);
      });
    });
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reaction]) => reaction);
    const keys = top.map((reaction, index) => ({ reaction, key: `series${index}` }));

    const rows = months.map((month) => {
      const row = { month: monthLabel(month) };
      keys.forEach(({ reaction, key }) => {
        row[key] = scoped.filter(
          (event) =>
            monthKey(event.date) === month && (event.reactions || []).some((r) => r.toLowerCase() === reaction.toLowerCase()),
        ).length;
      });
      return row;
    });
    return { chartData: rows, seriesKeys: keys };
  }, [scoped]);

  const flags = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const grouped = new Map();
    events.forEach((event) => {
      (event.reactions || []).forEach((reaction) => {
        const key = `${event.product}||${reaction}`;
        if (!grouped.has(key)) grouped.set(key, { product: event.product, reaction, entries: [] });
        grouped.get(key).entries.push(event);
      });
    });
    return [...grouped.values()]
      .map((entry) => {
        const recent = entry.entries.filter((e) => new Date(e.date) >= cutoff);
        const unexpected = entry.entries.some((e) => e.expectedness === "Unexpected");
        return { ...entry, count90: recent.length, unexpected, lastDate: recent[0]?.date || entry.entries[0]?.date };
      })
      .filter((entry) => entry.count90 >= 3 || entry.unexpected)
      .sort((a, b) => b.count90 - a.count90);
  }, [events]);

  return (
    <>
      <PageHeader
        eyebrow="Signal detection"
        title="Reactions over time"
        description="Reactions from confirmed articles and cases, grouped by product and month. A reaction is flagged when it appears 3 or more times in 90 days, or is unexpected against the Canadian label."
        actions={
          <select
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="h-9 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px] font-medium"
          >
            {products.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="surface-card p-4 lg:col-span-7">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0D9488]" />
            <h2 className="text-[13px] font-bold text-[#0F172A]">Reactions per month · last 12 months</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E2E8F0" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesKeys.map(({ reaction, key }, index) => (
                  <Bar key={key} dataKey={key} name={reaction} stackId="a" fill={SERIES[index]?.color || "#94A3B8"} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!seriesKeys.length && (
            <p className="mt-2 text-[12px] text-[#64748B]">No reactions recorded yet for this selection.</p>
          )}
        </section>

        <section className="surface-card lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
            <h2 className="text-[13px] font-bold text-[#0F172A]">Flagged signals</h2>
            <span className="ml-auto rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">{flags.length}</span>
          </div>
          <ul className="divide-y divide-[#E2E8F0]">
            {flags.map((flag) => (
              <li key={`${flag.product}-${flag.reaction}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#0F172A]">{flag.reaction}</p>
                    <p className="text-[11px] text-[#64748B]">{flag.product}</p>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10.5px] font-bold ${
                      flag.count90 >= 3 ? "border-red-200 bg-red-50 text-[#DC2626]" : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {flag.count90 >= 3 ? `${flag.count90} in 90 days` : "Unexpected"}
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-[#64748B]">
                  {flag.unexpected ? "Not described in the Canadian label · " : ""}
                  most recent {formatDate(flag.lastDate)}
                </p>
              </li>
            ))}
            {!flags.length && (
              <li className="px-4 py-8 text-center text-[12px] text-[#64748B]">
                No reaction meets the flagging rule yet.
              </li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}