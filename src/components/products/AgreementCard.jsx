import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Handshake, Save } from "lucide-react";
import { savePvAgreement } from "@/lib/icsr-fns";
import { formatDate } from "@/lib/pv";

export default function AgreementCard({ product, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    imported: !!product.imported,
    partnerCompany: product.partner_company || "",
    screensLiterature: product.screens_literature || "Seaford",
    reportsToHc: product.reports_to_hc || "Seaford",
    effectiveDate: product.agreement_effective_date || "",
    daysToExchange: product.partner_days_to_exchange ?? 0,
  });
  const saveFn = useServerFn(savePvAgreement);
  const queryClient = useQueryClient();

  useEffect(() => {
    setForm({
      imported: !!product.imported,
      partnerCompany: product.partner_company || "",
      screensLiterature: product.screens_literature || "Seaford",
      reportsToHc: product.reports_to_hc || "Seaford",
      effectiveDate: product.agreement_effective_date || "",
      daysToExchange: product.partner_days_to_exchange ?? 0,
    });
  }, [product.id, product.partner_company, product.imported]);

  const save = async () => {
    setBusy(true);
    try {
      await saveFn({
        data: {
          productId: product.id,
          imported: form.imported,
          partnerCompany: form.partnerCompany,
          screensLiterature: form.screensLiterature,
          reportsToHc: form.reportsToHc,
          effectiveDate: form.effectiveDate,
          daysToExchange: Number(form.daysToExchange) || 0,
        },
      });
      toast.success("PV agreement saved");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pv"] });
    } catch (error) {
      toast.error(error?.message || "Could not save the agreement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-[#E2E8F0] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#0F172A]">
          <Handshake className="h-3.5 w-3.5 text-[#0D9488]" /> PV agreement
        </p>
        {isAdmin && (
          <button onClick={() => setOpen((value) => !value)} className="text-[10.5px] font-semibold text-[#0D9488]">
            {open ? "Close" : "Edit agreement"}
          </button>
        )}
      </div>

      <p className="mt-1 text-[10.5px] text-[#64748B]">
        {product.imported ? "Imported product" : "Own product"} · partner {product.partner_company || "none"} · literature
        screened by {product.screens_literature || "Seaford"} · reports to Health Canada by {product.reports_to_hc || "Seaford"}
        {product.agreement_effective_date ? ` · effective ${formatDate(product.agreement_effective_date)}` : ""}
        {product.partner_days_to_exchange ? ` · ${product.partner_days_to_exchange} days to exchange cases` : ""}
      </p>

      {open && isAdmin && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[#475569]">
            <input
              type="checkbox"
              checked={form.imported}
              onChange={(event) => setForm((prev) => ({ ...prev, imported: event.target.checked }))}
              className="h-3.5 w-3.5 accent-[#0D9488]"
            />
            Imported or licensed product
          </label>
          <input
            value={form.partnerCompany}
            onChange={(event) => setForm((prev) => ({ ...prev, partnerCompany: event.target.value }))}
            placeholder="Partner company"
            className="h-8 rounded border border-[#E2E8F0] px-2 text-[11.5px]"
          />
          <select
            value={form.screensLiterature}
            onChange={(event) => setForm((prev) => ({ ...prev, screensLiterature: event.target.value }))}
            className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
          >
            <option>Seaford</option>
            <option>Partner</option>
            <option>Both</option>
          </select>
          <select
            value={form.reportsToHc}
            onChange={(event) => setForm((prev) => ({ ...prev, reportsToHc: event.target.value }))}
            className="h-8 rounded border border-[#E2E8F0] bg-white px-1.5 text-[11.5px]"
          >
            <option>Seaford</option>
            <option>Partner</option>
          </select>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={(event) => setForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
            className="h-8 rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
          />
          <input
            type="number"
            min="0"
            value={form.daysToExchange}
            onChange={(event) => setForm((prev) => ({ ...prev, daysToExchange: event.target.value }))}
            placeholder="Days to exchange cases"
            className="h-8 rounded border border-[#E2E8F0] px-1.5 text-[11.5px]"
          />
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            <Save className="h-3 w-3" /> Save agreement
          </button>
        </div>
      )}
    </div>
  );
}