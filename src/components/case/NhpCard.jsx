import { useEffect, useState } from "react";
import { Save } from "lucide-react";

const FIELDS = [
  { key: "nhp_npn", label: "NPN" },
  { key: "latin_binomial", label: "Latin binomial" },
  { key: "plant_part", label: "Plant part" },
  { key: "extract_type", label: "Extract type" },
  { key: "solvent", label: "Extraction solvent" },
  { key: "homeopathic_potency", label: "Homeopathic potency" },
];

export default function NhpCard({ record, onSave, canWrite, busy }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((field) => [field.key, record[field.key] || ""])));
  }, [record.id]);

  return (
    <section className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-[#0F172A]">Natural health product fields</h2>
          <p className="text-[10.5px] text-[#64748B]">Required on the Health Canada Natural Health Product reporting form.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => onSave(values)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded bg-[#0D9488] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="label-caps">{field.label}</span>
            <input
              value={values[field.key] || ""}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              disabled={!canWrite}
              className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
            />
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className="label-caps">Ingredients and quantities</span>
          <input
            value={values.ingredients_quantities || ""}
            onChange={(event) => setValues((prev) => ({ ...prev, ingredients_quantities: event.target.value }))}
            disabled={!canWrite}
            placeholder="e.g. Valeriana officinalis root extract 250 mg per capsule"
            className="mt-0.5 h-8 w-full rounded border border-[#E2E8F0] px-2 text-[11.5px] outline-none focus:border-[#0D9488]"
          />
        </label>
      </div>
    </section>
  );
}