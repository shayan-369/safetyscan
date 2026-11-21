// Server-only helpers for the pharmacovigilance pipeline.
const PUBMED = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTags(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function logAudit(sdk, { who, action, entity, entity_id, before, after }) {
  await sdk.entities.AuditLog.create({
    who: who || "System",
    action,
    entity,
    entity_id: entity_id || "",
    before: before ? JSON.stringify(before).slice(0, 4000) : "",
    after: after ? JSON.stringify(after).slice(0, 4000) : "",
    timestamp: new Date().toISOString(),
  });
}

/* ------------------------------ PubMed ------------------------------ */

export async function pubmedSearch({ query, start, end, retmax = 25 }) {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    retmode: "json",
    sort: "pub date",
  });
  if (start && end) {
    params.set("datetype", "pdat");
    params.set("mindate", start.replace(/-/g, "/"));
    params.set("maxdate", end.replace(/-/g, "/"));
  }
  const searchRes = await fetch(`${PUBMED}/esearch.fcgi?${params.toString()}`);
  if (!searchRes.ok) throw new Error(`PubMed search failed (${searchRes.status})`);
  const searchJson = await searchRes.json();
  const ids = searchJson?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  const fetchRes = await fetch(`${PUBMED}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}`);
  if (!fetchRes.ok) throw new Error(`PubMed fetch failed (${fetchRes.status})`);
  return parsePubmedXml(await fetchRes.text());
}

export function parsePubmedXml(xml) {
  const blocks = xml.split("<PubmedArticle>").slice(1);
  return blocks.map((block) => {
    const pmid = (block.match(/<PMID[^>]*>(\d+)<\/PMID>/) || [])[1] || "";
    const title = stripTags((block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/) || [])[1] || "");
    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) =>
      stripTags(m[1]),
    );
    const journal = stripTags(
      (block.match(/<Journal>[\s\S]*?<Title[^>]*>([\s\S]*?)<\/Title>/) || [])[1] ||
        (block.match(/<MedlineTA[^>]*>([\s\S]*?)<\/MedlineTA>/) || [])[1] ||
        "",
    );
    const authors = [...block.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g)]
      .map((m) => {
        const last = (m[1].match(/<LastName>([\s\S]*?)<\/LastName>/) || [])[1] || "";
        const first = (m[1].match(/<ForeName>([\s\S]*?)<\/ForeName>/) || [])[1] || "";
        const collective = (m[1].match(/<CollectiveName>([\s\S]*?)<\/CollectiveName>/) || [])[1] || "";
        return collective || [first, last].filter(Boolean).join(" ");
      })
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
    const doi = (block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/) || [])[1] || "";
    const year = (block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) || [])[1] || "";
    const month = (block.match(/<PubDate>[\s\S]*?<Month>([A-Za-z0-9]+)<\/Month>/) || [])[1] || "";
    const affiliation = stripTags((block.match(/<Affiliation>([\s\S]*?)<\/Affiliation>/) || [])[1] || "");

    return {
      pmid,
      doi,
      title,
      authors,
      journal,
      publication_date: [year, month].filter(Boolean).join(" "),
      abstract: abstractParts.join(" "),
      full_text_url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      country: affiliation,
    };
  });
}

/* --------------------------- import parsing --------------------------- */

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || "";
    });
    return {
      title: row.title || row.articletitle || row.ti || "",
      authors: row.authors || row.author || row.au || "",
      journal: row.journal || row.source || row.jo || row.journaltitle || "",
      publication_date: row.publicationdate || row.year || row.date || row.py || "",
      abstract: row.abstract || row.ab || "",
      pmid: row.pmid || "",
      doi: row.doi || "",
      country: row.country || "",
      full_text_url: row.url || row.fulltexturl || row.link || "",
    };
  });
}

export function parseRis(text) {
  const records = [];
  let current = {};
  let lastTag = null;
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/);
    if (match) {
      const [, tag, value] = match;
      if (tag === "ER") {
        if (current.title) records.push(current);
        current = {};
        lastTag = null;
        return;
      }
      lastTag = tag;
      if (tag === "AU" || tag === "A1") {
        current.authors = current.authors ? `${current.authors}, ${value}` : value;
      } else if (tag === "TI" || tag === "T1") current.title = value;
      else if (tag === "AB" || tag === "N2") current.abstract = current.abstract ? `${current.abstract} ${value}` : value;
      else if (tag === "JO" || tag === "JF" || tag === "T2") current.journal = current.journal || value;
      else if (tag === "PY" || tag === "Y1") current.publication_date = current.publication_date || value;
      else if (tag === "DO") current.doi = value;
      else if (tag === "AN" || tag === "PM") current.pmid = current.pmid || value;
      else if (tag === "UR") current.full_text_url = current.full_text_url || value;
      else if (tag === "CY") current.country = value;
    } else if (lastTag && line.trim()) {
      // continuation line
      const value = line.trim();
      if (lastTag === "AB" || lastTag === "N2") current.abstract = `${current.abstract || ""} ${value}`.trim();
      if (lastTag === "TI" || lastTag === "T1") current.title = `${current.title || ""} ${value}`.trim();
    }
  });
  if (current.title) records.push(current);
  return records.map((r) => ({
    title: r.title || "",
    authors: r.authors || "",
    journal: r.journal || "",
    publication_date: r.publication_date || "",
    abstract: r.abstract || "",
    pmid: r.pmid || "",
    doi: r.doi || "",
    country: r.country || "",
    full_text_url: r.full_text_url || "",
  }));
}

export function parseImport(text, format) {
  if (format === "ris" || /^TY\s{2}-/m.test(text)) return parseRis(text);
  return parseCsv(text);
}

/* ------------------------------- AI triage ------------------------------- */

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number", description: "Index of the article in the input list" },
          category: {
            type: "string",
            enum: ["Potential Reportable Case", "Safety Information/Possible Signal", "Not Relevant"],
          },
          not_relevant_reason: {
            type: "string",
            enum: [
              "Animal or lab study",
              "Different product or ingredient",
              "No adverse event",
              "Review article with no new cases",
              "Other",
            ],
          },
          human_subject: { type: "string", enum: ["yes", "no", "unclear"] },
          adverse_event_present: { type: "boolean" },
          identifiable_patient: { type: "boolean" },
          identifiable_reporter: { type: "boolean" },
          suspect_product_named: { type: "boolean" },
          brand_identified: { type: "string", enum: ["yes", "no"] },
          reactions: { type: "array", items: { type: "string" } },
          seriousness: { type: "string", enum: ["Serious", "Non-serious", "Unclear"] },
          seriousness_criteria: { type: "array", items: { type: "string" } },
          expectedness: { type: "string", enum: ["Expected", "Unexpected", "Unclear"] },
          occurred_in: { type: "string", enum: ["Canada", "Foreign", "Unknown"] },
          confidence: { type: "number", description: "0-100 confidence in this triage" },
          evidence_quotes: {
            type: "array",
            items: { type: "string" },
            description: "Short verbatim quotes from the abstract supporting the fields",
          },
          ai_summary: { type: "string", description: "Two sentence summary" },
        },
        required: ["index", "category", "confidence", "ai_summary"],
      },
    },
  },
  required: ["results"],
};

function buildTriagePrompt(batch) {
  const articles = batch
    .map(
      (item) => `ARTICLE index ${item.index}
Title: ${item.title}
Journal: ${item.journal || "unknown"}
Products under surveillance that matched: ${item.products
        .map(
          (p) =>
            `${p.brand_name} (ingredients: ${(p.active_ingredients || []).join(", ") || "n/a"}; also known as: ${(
              p.synonyms || []
            ).join(", ") || "none"}; reactions already in the Canadian label: ${(p.labelled_reactions || []).join(", ") || "none"})`,
        )
        .join(" | ")}
Abstract: ${(item.abstract || "No abstract available.").slice(0, 3500)}`,
    )
    .join("\n\n---\n\n");

  return `You are a pharmacovigilance triage assistant for a Canadian pharmaceutical company. You perform a FIRST-PASS screen of literature for individual case safety reports (ICSRs) about the company's products. A qualified human reviewer makes every final decision.

For each article below, decide:
1. category: "Potential Reportable Case" when the article describes one or more identifiable individual patients who experienced an adverse event after exposure to one of the listed products (or the same active ingredient/brand). "Safety Information/Possible Signal" when the article is about the product and mentions adverse events but has no individual case (e.g. aggregate cohort percentages, pharmacology, signals without a patient). "Not Relevant" only when clearly none of the above (animal or lab study, different product/ingredient, no adverse event, review with no new cases).
2. not_relevant_reason: only when category is "Not Relevant".
3. human_subject, adverse_event_present, identifiable_patient, identifiable_reporter, suspect_product_named (booleans / yes-no-unclear).
4. brand_identified: "yes" if the article names the company brand; "no" if it only names the ingredient or an unnamed product (then the reviewer assumes the company product and flags "brand not identified").
5. reactions: the adverse events, as short clinical terms.
6. seriousness: "Serious" if death, life-threatening, hospitalization, disability, congenital anomaly or medically important; "Non-serious" if none; "Unclear" if the abstract does not say. seriousness_criteria lists which of Death, Life-threatening, Hospitalization, Disability, Congenital anomaly, Medically important apply.
7. expectedness: compare each reaction with the product's labelled reactions. "Expected" if described in the label, "Unexpected" if not, "Unclear" if you cannot tell.
8. occurred_in: "Canada", "Foreign" or "Unknown", based on where the patient was treated.
9. confidence: 0-100.
10. evidence_quotes: 1-4 SHORT verbatim quotes copied exactly from the abstract that support your key fields.
11. ai_summary: two sentences.

Rules: Be cautious. If you are unsure about anything, choose "Unclear" and lower the confidence; never invent details that are not in the abstract. Never exclude an article you are not highly confident about. You never make the final regulatory decision.

Return JSON with a "results" array containing one object per article, matching each input index.

${articles}`;
}

function fallbackTriage(index) {
  return {
    index,
    category: "Safety Information/Possible Signal",
    human_subject: "unclear",
    adverse_event_present: false,
    identifiable_patient: false,
    identifiable_reporter: false,
    suspect_product_named: false,
    brand_identified: "no",
    reactions: [],
    seriousness: "Unclear",
    seriousness_criteria: [],
    expectedness: "Unclear",
    occurred_in: "Unknown",
    confidence: 0,
    evidence_quotes: [],
    ai_summary: "AI triage could not be completed for this record. Manual review is required.",
  };
}

export async function triageArticles(sdk, items, threshold = 85) {
  const results = [];
  const size = 6;
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    let parsed = [];
    try {
      const response = await sdk.integrations.Core.InvokeLLM({
        prompt: buildTriagePrompt(batch),
        response_json_schema: TRIAGE_SCHEMA,
      });
      parsed = Array.isArray(response?.results) ? response.results : [];
    } catch (error) {
      parsed = [];
    }
    batch.forEach((item) => {
      const match = parsed.find((r) => Number(r.index) === item.index);
      const triage = match ? { ...match } : fallbackTriage(item.index);
      if (!["Potential Reportable Case", "Safety Information/Possible Signal", "Not Relevant"].includes(triage.category)) {
        triage.category = "Safety Information/Possible Signal";
      }
      if (triage.category === "Not Relevant" && Number(triage.confidence) < threshold) {
        triage.category = "Safety Information/Possible Signal";
        triage.ai_summary = `${triage.ai_summary || ""} Confidence below the ${threshold}% auto-exclusion threshold, so this record is routed to human review.`.trim();
      }
      if (triage.category !== "Not Relevant") triage.not_relevant_reason = undefined;
      if (triage.category === "Not Relevant" && !triage.not_relevant_reason) triage.not_relevant_reason = "Other";
      results.push({ ...triage, confidence: Math.max(0, Math.min(100, Number(triage.confidence) || 0)) });
    });
  }
  return results;
}

const CASE_SCHEMA = {
  type: "object",
  properties: {
    age: { type: "number" },
    sex: { type: "string", enum: ["Female", "Male", "Other", "Unknown"] },
    patient_descriptor: { type: "string" },
    reporter: { type: "string" },
    narrative: { type: "string" },
  },
  required: ["narrative"],
};

export async function draftCaseContent(sdk, { article, triage, product }) {
  const prompt = `Draft the structured fields and narrative for a Canadian pharmacovigilance individual case safety report (ICSR).

Article title: ${article.title}
Journal: ${article.journal || "unknown"}
Authors: ${article.authors || "unknown"}
Abstract: ${(article.abstract || "").slice(0, 3500)}

Suspect product: ${product?.brand_name || "company product"} (ingredients: ${(product?.active_ingredients || []).join(", ") || "unknown"})
Reactions identified: ${(triage?.reactions || []).join(", ") || "unknown"}
Seriousness: ${triage?.seriousness || "Unclear"}; criteria: ${(triage?.seriousness_criteria || []).join(", ") || "none"}
Expectedness: ${triage?.expectedness || "Unclear"}; occurred in: ${triage?.occurred_in || "Unknown"}

Return JSON: age (number, 0 if unknown), sex, patient_descriptor (e.g. "58-year-old woman, Toronto"), reporter (the article authors in "Last FM" style), and a narrative of 120-180 words written in neutral regulatory style: patient, suspect product, dose/route if stated, adverse event with dates and outcome, seriousness criteria, reporter and country. Use only facts from the abstract; write "not reported" where a fact is missing. Do not invent details.`;

  try {
    const res = await sdk.integrations.Core.InvokeLLM({ prompt, response_json_schema: CASE_SCHEMA });
    return {
      age: Number(res?.age) || 0,
      sex: res?.sex || "Unknown",
      patient_descriptor: res?.patient_descriptor || "Patient described in article",
      reporter: res?.reporter || article.authors || "Article authors",
      narrative: res?.narrative || "",
    };
  } catch (error) {
    return {
      age: 0,
      sex: "Unknown",
      patient_descriptor: "Patient described in article",
      reporter: article.authors || "Article authors",
      narrative: `AI narrative draft unavailable. Source article: ${article.title}. Abstract: ${(article.abstract || "").slice(0, 900)}`,
    };
  }
}