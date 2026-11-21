const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highlights product names, ingredients and synonyms (whole words, any case). */
function ProductTerms({ text, terms }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(?<![A-Za-z0-9])(${terms.map(escapeRegExp).join("|")})(?![A-Za-z0-9])`, "gi");
  const lowered = terms.map((t) => t.toLowerCase());
  return (
    <>
      {String(text).split(pattern).map((part, index) =>
        lowered.includes(part.toLowerCase()) ? (
          <mark key={index} className="rounded-sm border-b-2 border-sky-500 bg-sky-100 px-0.5 font-semibold text-sky-900">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function HighlightedText({ text, quotes, terms }) {
  const usable = (quotes || []).filter((q) => q && q.trim().length > 3);
  if (!usable.length) return <ProductTerms text={text} terms={terms} />;

  const pattern = new RegExp(`(${usable.map(escapeRegExp).join("|")})`, "gi");
  const parts = String(text || "").split(pattern);
  const lowered = usable.map((q) => q.toLowerCase());

  return (
    <>
      {parts.map((part, index) =>
        lowered.includes(part.toLowerCase()) ? (
          <mark key={index} className="evidence-mark">
            <ProductTerms text={part} terms={terms} />
          </mark>
        ) : (
          <ProductTerms key={index} text={part} terms={terms} />
        ),
      )}
    </>
  );
}

export default function ArticlePane({ article, triage, products }) {
  const matched = products.filter((p) => (article.matched_products || []).includes(p.id));
  // Longest first so "Polyride Fe Ultra" wins over "Polyride Fe".
  const terms = [
    ...new Set(
      matched
        .flatMap((p) => [p.brand_name, ...(p.active_ingredients || []), ...(p.synonyms || [])])
        .filter((t) => t && t.trim().length > 2)
        .map((t) => t.trim()),
    ),
  ].sort((a, b) => b.length - a.length);

  return (
    <section className="surface-card flex h-full flex-col">
      <div className="border-b border-[#E2E8F0] p-4">
        <p className="label-caps">
          {article.source_database} · {article.journal || "Journal not recorded"} · {article.publication_date || "date unknown"}
        </p>
        <h2 className="mt-1 text-[15px] font-bold leading-6 text-[#0F172A]">
          <ProductTerms text={article.title || ""} terms={terms} />
        </h2>
        <p className="mt-1 text-[11.5px] text-[#64748B]">{article.authors || "Authors not recorded"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {article.pmid && (
            <a
              href={article.full_text_url || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10.5px] text-[#0D9488]"
            >
              PMID {article.pmid}
            </a>
          )}
          {article.doi && <span className="font-mono text-[10.5px] text-[#64748B]">DOI {article.doi}</span>}
          {matched.map((p) => (
            <span key={p.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#475569]">
              {p.brand_name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="label-caps">Abstract</span>
          <span className="rounded border-b-2 border-sky-500 bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-900">
            Product / ingredient
          </span>
          <span className="evidence-mark rounded text-[9.5px] font-semibold">AI evidence</span>
        </div>
        <p className="text-[13px] leading-[21px] text-[#1E293B]">
          <HighlightedText
            text={article.abstract || "No abstract available for this record."}
            quotes={triage?.evidence_quotes}
            terms={terms}
          />
        </p>
      </div>
    </section>
  );
}