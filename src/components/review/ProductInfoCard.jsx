import { Pill } from "lucide-react";

const norm = (value) => String(value || "").toLowerCase().trim();

function onLabel(reaction, labelled) {
  const r = norm(reaction);
  return labelled.some((l) => {
    const term = norm(l);
    return term && (r.includes(term) || term.includes(r));
  });
}

function Chips({ items, tone = "slate", empty }) {
  const styles = {
    slate: "bg-slate-100 text-[#475569]",
    sky: "bg-sky-100 text-sky-900",
  };
  if (!items?.length) return <span className="text-[11px] text-amber-700">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
      {children}
    </div>
  );
}

/** Facts from the product register (not AI) for the products matched to the article under review. */
export default function ProductInfoCard({ products = [], triage }) {
  if (!products.length) {
    return (
      <section className="surface-card border-amber-200 bg-amber-50 p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-800">
          <Pill className="h-3.5 w-3.5" /> No product matched
        </p>
        <p className="mt-0.5 text-[11px] text-amber-800">
          Check whether the brand is not identified. If unsure, assume it is our product.
        </p>
      </section>
    );
  }

  const labelled = products.flatMap((p) => p.labelled_reactions || []);
  const reactions = triage?.reactions || [];

  return (
    <section className="surface-card">
      <div className="flex items-center gap-1.5 border-b border-[#E2E8F0] px-3 py-2">
        <Pill className="h-3.5 w-3.5 text-sky-700" />
        <p className="text-[12px] font-bold text-[#0F172A]">Product information</p>
        <span className="ml-auto text-[10px] text-[#94A3B8]">From the product register</span>
      </div>

      <div className="space-y-3 p-3">
        {products.map((product) => {
          const licenceLabel = product.product_type === "Natural Health Product" ? "NPN" : "DIN";
          return (
            <div key={product.id} className="space-y-2.5">
              <div>
                <p className="text-[13px] font-bold text-[#0F172A]">{product.brand_name}</p>
                <p className="text-[11px] text-[#64748B]">
                  {product.product_type || "Type not set"} · {licenceLabel} {product.licence_number || "not recorded"}
                  {product.division ? ` · ${product.division}` : ""}
                </p>
              </div>
              <Row label="Active ingredients">
                <Chips items={product.active_ingredients} tone="sky" empty="No ingredients recorded" />
              </Row>
              {(product.synonyms || []).length > 0 && (
                <Row label="Also searched as">
                  <Chips items={product.synonyms} tone="sky" />
                </Row>
              )}
              <Row label="Labelled reactions (Canadian label)">
                <Chips
                  items={product.labelled_reactions}
                  empty="Label reactions incomplete - every reaction is treated as unexpected"
                />
              </Row>
            </div>
          );
        })}

        {reactions.length > 0 && (
          <Row label="AI reactions vs label">
            <ul className="space-y-1">
              {reactions.map((reaction) => {
                const expected = onLabel(reaction, labelled);
                return (
                  <li key={reaction} className="flex items-center justify-between gap-2 text-[11.5px] text-[#1E293B]">
                    <span>{reaction}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        expected ? "bg-slate-100 text-[#475569]" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {expected ? "On label" : "Not on label"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Row>
        )}
      </div>
    </section>
  );
}
