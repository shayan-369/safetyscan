import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { formatDate, pvRoleOf } from "@/lib/pv";
import { useProducts, useStrategies } from "@/hooks/usePv";
import PageHeader from "@/components/pv/PageHeader";
import StatusPill from "@/components/pv/StatusPill";
import ProductDialog from "@/components/products/ProductDialog";
import StrategyDialog from "@/components/products/StrategyDialog";
import { ChevronDown, History, Pencil, Plus } from "lucide-react";

export const Route = createFileRoute("/_authed/products")({
  head: () => ({ meta: [{ title: "Products & strategies · SafetyScan PV" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = pvRoleOf(user) === "Admin";
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProducts();
  const { data: strategies = [] } = useStrategies();

  const [productDialog, setProductDialog] = useState({ open: false, product: null });
  const [strategyDialog, setStrategyDialog] = useState({ open: false, strategy: null, productId: null });
  const [openHistory, setOpenHistory] = useState({});

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pv"] });
  };

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Products & search strategies"
        description="Each product carries the ingredients, synonyms and Canadian label reactions the AI compares against. Every query change creates a new version with a reason."
        actions={
          isAdmin && (
            <>
              <button
                onClick={() => setProductDialog({ open: true, product: null })}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0D9488] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#0B7F76]"
              >
                <Plus className="h-3.5 w-3.5" /> Add product
              </button>
              <button
                onClick={() => setStrategyDialog({ open: true, strategy: null, productId: null })}
                disabled={!products.length}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E293B] disabled:opacity-50"
              >
                New strategy
              </button>
            </>
          )
        }
      />

      {isLoading ? (
        <p className="text-[13px] text-[#64748B]">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-[13px] font-semibold text-[#0F172A]">No products yet</p>
          <p className="mt-1 text-[12px] text-[#64748B]">Add the company's products to start weekly surveillance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const versions = strategies
              .filter((s) => s.product === product.id)
              .sort((a, b) => (b.version || 0) - (a.version || 0));
            const active = versions.find((v) => v.active !== false);
            const history = versions.filter((v) => v.id !== active?.id);

            return (
              <section key={product.id} className="surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-bold text-[#0F172A]">{product.brand_name}</h2>
                      <StatusPill tone="navy">{product.product_type}</StatusPill>
                      {product.division && <StatusPill tone="slate">{product.division}</StatusPill>}
                      {product.active === false && <StatusPill tone="amber">Inactive</StatusPill>}
                    </div>
                    <p className="mt-1 text-[12px] text-[#64748B]">
                      {product.licence_number || "No licence number"} · {(product.active_ingredients || []).join(", ") || "no ingredients recorded"}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setProductDialog({ open: true, product })}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => setStrategyDialog({ open: true, strategy: active || null, productId: product.id })}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" /> Strategy
                      </button>
                    </div>
                  )}
                </div>

                {product.indication && (
                  <p className="mt-3 text-[12px] text-[#475569]">
                    <span className="font-semibold text-[#0F172A]">Indication: </span>
                    {product.indication}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(product.labelled_reactions || []).map((reaction) => (
                    <span key={reaction} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#475569]">
                      {reaction}
                    </span>
                  ))}
                  {!(product.labelled_reactions || []).length && (
                    <span className="text-[11px] text-[#94A3B8]">No labelled reactions recorded</span>
                  )}
                </div>

                <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  {active ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="label-caps">Active strategy · v{active.version}</span>
                          <StatusPill tone="teal">{active.database}</StatusPill>
                        </div>
                        <span className="text-[11px] text-[#64748B]">
                          {active.created_by || "—"} · {formatDate(active.created_date)}
                        </span>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#0F172A]">
                        {active.query_string}
                      </pre>
                      {active.change_reason && (
                        <p className="mt-1 text-[11px] text-[#64748B]">Reason: {active.change_reason}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[12px] text-[#64748B]">No search strategy yet for this product.</p>
                  )}

                  {history.length > 0 && (
                    <div className="mt-2 border-t border-[#E2E8F0] pt-2">
                      <button
                        onClick={() => setOpenHistory((prev) => ({ ...prev, [product.id]: !prev[product.id] }))}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488]"
                      >
                        <History className="h-3 w-3" /> Version history ({history.length})
                        <ChevronDown className={`h-3 w-3 transition-transform ${openHistory[product.id] ? "rotate-180" : ""}`} />
                      </button>
                      {openHistory[product.id] && (
                        <ul className="mt-2 space-y-2">
                          {history.map((version) => (
                            <li key={version.id} className="rounded border border-[#E2E8F0] bg-white p-2">
                              <p className="text-[11px] font-semibold text-[#0F172A]">
                                v{version.version} · {version.database} · {formatDate(version.created_date)} · {version.created_by || "—"}
                              </p>
                              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10.5px] text-[#475569]">
                                {version.query_string}
                              </pre>
                              <p className="mt-1 text-[10.5px] text-[#64748B]">Reason: {version.change_reason || "—"}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ProductDialog
        open={productDialog.open}
        onOpenChange={(open) => setProductDialog({ open, product: productDialog.product })}
        product={productDialog.product}
        onSaved={refresh}
      />
      <StrategyDialog
        open={strategyDialog.open}
        onOpenChange={(open) => setStrategyDialog((prev) => ({ ...prev, open }))}
        strategy={strategyDialog.strategy}
        defaultProductId={strategyDialog.productId}
        products={products}
        onSaved={refresh}
      />
    </>
  );
}