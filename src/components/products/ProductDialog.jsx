import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveProduct } from "@/lib/server-fns";
import FormDialog from "@/components/pv/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  brand_name: "",
  active_ingredients: "",
  synonyms: "",
  product_type: "Drug",
  licence_number: "",
  division: "Community",
  indication: "",
  labelled_reactions: "",
  active: true,
};

const toList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function ProductDialog({ open, onOpenChange, product, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveProduct);

  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? {
            brand_name: product.brand_name || "",
            active_ingredients: (product.active_ingredients || []).join(", "),
            synonyms: (product.synonyms || []).join(", "),
            product_type: product.product_type || "Drug",
            licence_number: product.licence_number || "",
            division: product.division || "Community",
            indication: product.indication || "",
            labelled_reactions: (product.labelled_reactions || []).join(", "),
            active: product.active !== false,
          }
        : EMPTY,
    );
  }, [open, product]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    if (!form.brand_name.trim()) {
      toast.error("A brand name is required.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: product?.id,
          brand_name: form.brand_name.trim(),
          active_ingredients: toList(form.active_ingredients),
          synonyms: toList(form.synonyms),
          product_type: form.product_type,
          licence_number: form.licence_number.trim(),
          division: form.division,
          indication: form.indication.trim(),
          labelled_reactions: toList(form.labelled_reactions),
          active: form.active,
        },
      });
      toast.success(product ? "Product updated" : "Product added");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  const field = "h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[13px] text-[#1E293B] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-teal-100";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product ? "Edit product" : "Add product"}
      description="Labelled reactions are used by the AI to judge expected vs unexpected."
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
            {saving ? "Saving…" : "Save product"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Brand name</Label>
          <Input value={form.brand_name} onChange={set("brand_name")} placeholder="e.g. Drysol" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Product type</Label>
            <select className={field} value={form.product_type} onChange={set("product_type")}>
              <option>Drug</option>
              <option>Natural Health Product</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Licence number</Label>
            <Input value={form.licence_number} onChange={set("licence_number")} placeholder="DIN or NPN" />
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Division</Label>
          <select className={field} value={form.division} onChange={set("division")}>
            <option>Community</option>
            <option>Hospital</option>
          </select>
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Active ingredients (comma separated)</Label>
          <Input value={form.active_ingredients} onChange={set("active_ingredients")} placeholder="aluminum chloride hexahydrate" />
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Synonyms (comma separated)</Label>
          <Input value={form.synonyms} onChange={set("synonyms")} placeholder="aluminium chloride, Drysol Dab-O-Matic" />
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Labelled reactions (comma separated)</Label>
          <Input value={form.labelled_reactions} onChange={set("labelled_reactions")} placeholder="skin irritation, burning, itching" />
        </div>
        <div>
          <Label className="mb-1 block text-[11px] font-semibold text-[#475569]">Indication</Label>
          <Textarea value={form.indication} onChange={set("indication")} rows={2} placeholder="Approved indication" />
        </div>
        <label className="flex items-center gap-2 text-[12px] font-medium text-[#475569]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            className="h-4 w-4 rounded border-[#CBD5E1] accent-[#0D9488]"
          />
          Include in weekly searches
        </label>
      </div>
    </FormDialog>
  );
}