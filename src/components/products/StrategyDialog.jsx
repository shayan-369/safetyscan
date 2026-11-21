import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveStrategy } from "@/lib/server-fns";
import FormDialog from "@/components/pv/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const field =
  "h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[13px] text-[#1E293B] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-teal-100";

export default function StrategyDialog({ open, onOpenChange, strategy, products, defaultProductId, onSaved }) {
  const [form, setForm] = useState({ product: "", database: "PubMed", query_string: "", change_reason: "" });
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveStrategy);

  useEffect(() => {
    if (!open) return;
    setForm({
      product: strategy?.product || defaultProductId || products[0]?.id || "",
      database: strategy?.database || "PubMed",
      query_string: strategy?.query_string || "",
      change_reason: "",
    });
  }, [open, strategy, defaultProductId, products]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    if (!form.product || !form.query_string.trim()) {
      toast.error("Choose a product and enter the exact query.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: strategy?.id,
          product: form.product,
          database: form.database,
          query_string: form.query_string.trim(),
          change_reason: form.change_reason.trim() || (strategy ? "Query updated" : "Initial strategy"),
        },
      });
      toast.success("Strategy saved");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Could not save the strategy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={strategy ? "Edit search strategy" : "New search strategy"}
      description="Changing the query creates a new version and keeps the old one in the audit history."
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#64748B]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-[#0D9488] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : strategy ? "Save version" : "Create strategy"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Product</Label>
            <select className={field} value={form.product} onChange={set("product")} disabled={!!strategy}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Database</Label>
            <select className={field} value={form.database} onChange={set("database")}>
              <option>PubMed</option>
              <option>Embase import</option>
              <option>Canada Vigilance import</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Exact query string</Label>
          <Textarea
            value={form.query_string}
            onChange={set("query_string")}
            rows={4}
            className="font-mono text-[12px]"
            placeholder='("aluminum chloride"[tiab] OR "aluminium chloride"[tiab]) AND (adverse OR reaction)'
          />
          <p className="mt-1 text-[11px] text-[#64748B]">Saved verbatim in the weekly search log.</p>
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Reason for this version</Label>
          <Input value={form.change_reason} onChange={set("change_reason")} placeholder="e.g. added Canadian brand synonym" />
        </div>
      </div>
    </FormDialog>
  );
}