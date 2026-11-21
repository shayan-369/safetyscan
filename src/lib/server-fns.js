import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  addDaysISO,
  draftCaseContent,
  logAudit,
  normalizeTitle,
  parseImport,
  pubmedSearch,
  todayISO,
  triageArticles,
} from "@/lib/pv.server";

const WRITERS = ["PV Associate", "Medical Reviewer", "Admin"];

const roleOf = (user) => user?.pv_role || (user?.role === "admin" ? "Admin" : "PV Associate");
const nameOf = (user) => user?.full_name || user?.email || "System";
const rows = (page) => (Array.isArray(page) ? page : page?.items ?? []);

function assertWriter(user) {
  if (!WRITERS.includes(roleOf(user))) {
    throw Object.assign(new Error("Your role has read-only access."), { status: 403 });
  }
}
function assertAdmin(user) {
  if (roleOf(user) !== "Admin") {
    throw Object.assign(new Error("Only an Admin can change this."), { status: 403 });
  }
}

function matchProducts(article, products) {
  const text = `${article.title} ${article.abstract || ""}`.toLowerCase();
  const hits = products.filter((p) => {
    const needles = [p.brand_name, ...(p.active_ingredients || []), ...(p.synonyms || [])]
      .filter(Boolean)
      .map((n) => n.toLowerCase());
    return needles.some((n) => n.length > 3 && text.includes(n));
  });
  return hits.map((p) => p.id);
}

async function productsForArticle(sdk, article, products) {
  if (article.matched_products?.length) {
    return products.filter((p) => article.matched_products.includes(p.id));
  }
  return products.filter((p) => matchProducts(article, [p]).length);
}

async function ingestDrafts(sdk, run, drafts, { products, threshold, qcPct }) {
  const existing = rows(await sdk.entities.Article.list({ limit: 2000 })).filter((a) => a.search_run !== run.id);
  const byPmid = new Map();
  const byDoi = new Map();
  const byTitle = new Map();
  existing.forEach((a) => {
    if (a.pmid) byPmid.set(String(a.pmid), a);
    if (a.doi) byDoi.set(a.doi.toLowerCase(), a);
    if (a.title) byTitle.set(normalizeTitle(a.title), a);
  });

  const created = [];
  let duplicates = 0;

  for (const draft of drafts) {
    if (!draft.title) continue;
    const dup =
      (draft.pmid && byPmid.get(String(draft.pmid))) ||
      (draft.doi && byDoi.get(draft.doi.toLowerCase())) ||
      byTitle.get(normalizeTitle(draft.title));

    const article = await sdk.entities.Article.create({
      search_run: run.id,
      source_database: draft.source_database || "Other",
      pmid: draft.pmid || "",
      doi: draft.doi || "",
      title: draft.title,
      authors: draft.authors || "",
      journal: draft.journal || "",
      publication_date: draft.publication_date || "",
      abstract: draft.abstract || "",
      full_text_url: draft.full_text_url || "",
      country: draft.country || "",
      matched_products: draft.productId ? [draft.productId] : matchProducts(draft, products),
      duplicate_of: dup ? dup.id : "",
      status: dup ? "Decided" : "New",
    });

    if (dup) {
      duplicates += 1;
      created.push({ article, duplicate: true });
    } else {
      if (article.pmid) byPmid.set(String(article.pmid), article);
      if (article.doi) byDoi.set(article.doi.toLowerCase(), article);
      byTitle.set(normalizeTitle(article.title), article);
      created.push({ article, duplicate: false });
    }
  }

  const pending = created.filter((c) => !c.duplicate);
  const inputs = [];
  for (let i = 0; i < pending.length; i += 1) {
    const article = pending[i].article;
    const matched = await productsForArticle(sdk, article, products);
    inputs.push({
      index: i,
      title: article.title,
      abstract: article.abstract,
      journal: article.journal,
      products: matched.length ? matched : products,
    });
  }

  const triaged = pending.length ? await triageArticles(sdk, inputs, threshold) : [];
  const triageByIndex = new Map(triaged.map((t) => [Number(t.index), t]));

  const triageRecords = [];
  const articleUpdates = [];
  let aiExcluded = 0;

  pending.forEach((entry, index) => {
    const t = triageByIndex.get(index);
    if (!t) return;
    const excluded = t.category === "Not Relevant";
    if (excluded) aiExcluded += 1;
    const qcSample = excluded && Math.random() * 100 < qcPct;
    triageRecords.push({
      article: entry.article.id,
      category: t.category,
      not_relevant_reason: t.not_relevant_reason,
      human_subject: t.human_subject || "unclear",
      adverse_event_present: !!t.adverse_event_present,
      identifiable_patient: !!t.identifiable_patient,
      identifiable_reporter: !!t.identifiable_reporter,
      suspect_product_named: !!t.suspect_product_named,
      brand_identified: t.brand_identified || "no",
      reactions: t.reactions || [],
      seriousness: t.seriousness || "Unclear",
      seriousness_criteria: t.seriousness_criteria || [],
      expectedness: t.expectedness || "Unclear",
      occurred_in: t.occurred_in || "Unknown",
      confidence: t.confidence,
      evidence_quotes: (t.evidence_quotes || []).slice(0, 5),
      ai_summary: t.ai_summary || "",
      qc_sample: qcSample,
    });
    articleUpdates.push({ id: entry.article.id, status: "AI Triaged" });
  });

  if (triageRecords.length) await sdk.entities.Triage.bulkCreate(triageRecords);
  if (articleUpdates.length) await sdk.entities.Article.bulkUpdate(articleUpdates);

  const sentToReview = pending.length - aiExcluded;

  await sdk.entities.SearchRun.update(run.id, {
    total_hits: created.length,
    duplicates_removed: duplicates,
    ai_excluded: aiExcluded,
    sent_to_review: sentToReview,
    status: "Awaiting Review",
  });

  return { totalHits: created.length, duplicates, aiExcluded, sentToReview, triaged: pending.length };
}

async function reviewerEmails(sdk, settings) {
  const users = await sdk.entities.User.list();
  const emails = users
    .filter((u) => u.pv_role === "Medical Reviewer" || u.role === "admin")
    .map((u) => u.email);
  if (settings?.reviewer_email) emails.push(settings.reviewer_email);
  return [...new Set(emails.filter(Boolean))];
}

async function sendTemplated(sdk, template, variables, settings, subject) {
  const recipients = await reviewerEmails(sdk, settings);
  const sent = [];
  for (const to of recipients) {
    try {
      await sdk.integrations.Core.SendEmail({
        to,
        template_name: template,
        subject,
        variables,
        category: "transactional",
      });
      sent.push(to);
    } catch (error) {
      // A non-registered address simply cannot be reached; the case record is unaffected.
    }
  }
  return sent;
}

/* ----------------------------- weekly run ----------------------------- */

export const startWeeklyRun = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const who = nameOf(context.user);

    const [settingsPage, productPage] = await Promise.all([
      sdk.entities.AppSettings.list({ limit: 1 }),
      sdk.entities.Product.list({ limit: 200 }),
    ]);
    const settings = rows(settingsPage)[0] || {};
    const products = rows(productPage).filter((p) => p.active !== false);
    const threshold = Number(settings.confidence_threshold) || 85;
    const qcPct = Number(settings.qc_sample_percentage) || 10;

    const lastRun = rows(await sdk.entities.SearchRun.list({ sort: "-date_range_end", limit: 1 }))[0];
    const end = todayISO();
    let start = lastRun?.date_range_end ? addDaysISO(lastRun.date_range_end, 1) : addDaysISO(end, -7);
    if (start > end) start = end;

    const strategies = rows(await sdk.entities.SearchStrategy.filter({ active: true }, { limit: 200 }));
    const pubmedStrategies = strategies.filter((s) => s.database === "PubMed");

    const run = await sdk.entities.SearchRun.create({
      run_date: end,
      date_range_start: start,
      date_range_end: end,
      frequency: settings.search_frequency || "Weekly",
      status: "Running",
      strategies_used: strategies.map((s) => `${s.id} v${s.version} · ${s.database}`),
      total_hits: 0,
      duplicates_removed: 0,
      ai_excluded: 0,
      sent_to_review: 0,
      cases_created: 0,
    });

    const drafts = [];
    const warnings = [];
    for (const strategy of pubmedStrategies) {
      try {
        const found = await pubmedSearch({ query: strategy.query_string, start, end, retmax: 25 });
        found.forEach((item) => drafts.push({ ...item, source_database: "PubMed", productId: strategy.product }));
      } catch (error) {
        warnings.push(`${strategy.database} strategy v${strategy.version}: ${error.message}`);
      }
    }

    const result = await ingestDrafts(sdk, run, drafts, { products, threshold, qcPct });

    await logAudit(sdk, {
      who,
      action: `Started weekly run for ${start} to ${end}`,
      entity: "SearchRun",
      entity_id: run.id,
      after: { ...result, warnings },
    });

    return { runId: run.id, dateRangeStart: start, dateRangeEnd: end, ...result, warnings };
  });

/* ------------------------------ imports ------------------------------ */

export const importArticles = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      runId: z.string(),
      text: z.string().max(400000),
      format: z.enum(["csv", "ris", "auto"]).optional(),
      database: z.enum(["Embase import", "Canada Vigilance import", "Other"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const run = await sdk.entities.SearchRun.get(data.runId);

    const [settingsPage, productPage] = await Promise.all([
      sdk.entities.AppSettings.list({ limit: 1 }),
      sdk.entities.Product.list({ limit: 200 }),
    ]);
    const settings = rows(settingsPage)[0] || {};
    const products = rows(productPage);
    const parsed = parseImport(data.text, data.format || "auto");
    const drafts = parsed
      .filter((row) => row.title)
      .map((row) => ({ ...row, source_database: data.database || "Other" }));

    const result = await ingestDrafts(sdk, run, drafts, {
      products,
      threshold: Number(settings.confidence_threshold) || 85,
      qcPct: Number(settings.qc_sample_percentage) || 10,
    });

    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Imported ${drafts.length} records from ${data.database || "file"}`,
      entity: "SearchRun",
      entity_id: run.id,
      after: result,
    });

    return { ...result, imported: drafts.length };
  });

/* ------------------------------ decisions ------------------------------ */

export const decideArticle = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      articleId: z.string(),
      decision: z.enum(["Confirm AI", "Override"]),
      finalCategory: z.enum(["Potential Reportable Case", "Safety Information/Possible Signal", "Not Relevant"]),
      comment: z.string().max(4000).optional(),
      qcSample: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const who = nameOf(context.user);

    const article = await sdk.entities.Article.get(data.articleId);
    const triage = rows(await sdk.entities.Triage.filter({ article: article.id }, { limit: 1 }))[0];

    await sdk.entities.ReviewDecision.create({
      article: article.id,
      reviewer: who,
      reviewer_role: roleOf(context.user),
      decision: data.decision,
      final_category: data.finalCategory,
      comment: data.comment || "",
      decided_at: new Date().toISOString(),
      qc_sample: !!data.qcSample,
    });

    await sdk.entities.Article.update(article.id, { status: "Decided" });

    await logAudit(sdk, {
      who,
      action: `Review decision: ${data.decision} → ${data.finalCategory}`,
      entity: "Article",
      entity_id: article.id,
      before: { status: article.status, ai_category: triage?.category },
      after: { status: "Decided", final_category: data.finalCategory, comment: data.comment || "" },
    });

    let caseId = null;
    let caseNumber = null;

    if (data.finalCategory === "Potential Reportable Case") {
      const existing = rows(await sdk.entities.Case.filter({ article: article.id }, { limit: 1 }))[0];
      if (!existing) {
        const products = rows(await sdk.entities.Product.list({ limit: 200 }));
        const product =
          products.find((p) => (article.matched_products || []).includes(p.id)) ||
          products.find((p) => matchProducts(article, [p]).length) ||
          null;
        const draft = await draftCaseContent(sdk, { article, triage, product });
        const allCases = rows(await sdk.entities.Case.list({ limit: 2000 }));
        const dayZero = todayISO();
        const serious = triage?.seriousness === "Serious";
        const reportable =
          serious && (triage?.occurred_in === "Canada" || triage?.expectedness === "Unexpected");
        const created = await sdk.entities.Case.create({
          case_number: `PV-${dayZero.slice(0, 4)}-${String(allCases.length + 1).padStart(4, "0")}`,
          article: article.id,
          product: product?.id || "",
          product_name: product?.brand_name || "Product not matched",
          patient_initials_or_descriptor: draft.patient_descriptor,
          age: draft.age,
          sex: draft.sex,
          reporter: draft.reporter,
          reactions: triage?.reactions || [],
          seriousness: triage?.seriousness || "Unclear",
          seriousness_criteria: triage?.seriousness_criteria || [],
          expectedness: triage?.expectedness || "Unclear",
          occurred_in: triage?.occurred_in || "Unknown",
          day_zero: dayZero,
          due_date: reportable ? addDaysISO(dayZero, 15) : "",
          reportable_to_health_canada: reportable,
          brand_identified: triage?.brand_identified || "yes",
          narrative: draft.narrative,
          status: "Draft",
        });
        caseId = created.id;
        caseNumber = created.case_number;

        await logAudit(sdk, {
          who,
          action: `Case ${created.case_number} created from article`,
          entity: "Case",
          entity_id: created.id,
          after: { case_number: created.case_number, seriousness: created.seriousness, due_date: created.due_date },
        });

        const settings = rows(await sdk.entities.AppSettings.list({ limit: 1 }))[0] || {};
        if (settings.email_alerts !== false) {
          await sendTemplated(
            sdk,
            "CaseConfirmed",
            {
              case_number: created.case_number,
              product_name: created.product_name,
              seriousness: created.seriousness,
              due_date: created.due_date || "not reportable",
              reviewer: who,
            },
            settings,
            `Reportable case confirmed: ${created.case_number}`,
          );
        }
      }
    }

    return { articleId: article.id, caseId, caseNumber };
  });

/* ------------------------------ triage retry ------------------------------ */

export const retriageArticle = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ articleId: z.string() }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const article = await sdk.entities.Article.get(data.articleId);
    const products = rows(await sdk.entities.Product.list({ limit: 200 }));
    const settings = rows(await sdk.entities.AppSettings.list({ limit: 1 }))[0] || {};
    const matched = await productsForArticle(sdk, article, products);

    const [result] = await triageArticles(
      sdk,
      [{ index: 0, title: article.title, abstract: article.abstract, journal: article.journal, products: matched }],
      Number(settings.confidence_threshold) || 85,
    );

    const existing = rows(await sdk.entities.Triage.filter({ article: article.id }, { limit: 1 }))[0];
    const payload = {
      article: article.id,
      category: result.category,
      not_relevant_reason: result.not_relevant_reason,
      human_subject: result.human_subject || "unclear",
      adverse_event_present: !!result.adverse_event_present,
      identifiable_patient: !!result.identifiable_patient,
      identifiable_reporter: !!result.identifiable_reporter,
      suspect_product_named: !!result.suspect_product_named,
      brand_identified: result.brand_identified || "no",
      reactions: result.reactions || [],
      seriousness: result.seriousness || "Unclear",
      seriousness_criteria: result.seriousness_criteria || [],
      expectedness: result.expectedness || "Unclear",
      occurred_in: result.occurred_in || "Unknown",
      confidence: result.confidence,
      evidence_quotes: (result.evidence_quotes || []).slice(0, 5),
      ai_summary: result.ai_summary || "",
      qc_sample: existing?.qc_sample || false,
    };

    if (existing) await sdk.entities.Triage.update(existing.id, payload);
    else await sdk.entities.Triage.create(payload);

    await sdk.entities.Article.update(article.id, { status: "AI Triaged" });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Re-ran AI triage",
      entity: "Article",
      entity_id: article.id,
      before: existing ? { category: existing.category, confidence: existing.confidence } : null,
      after: { category: payload.category, confidence: payload.confidence },
    });

    return { articleId: article.id, category: payload.category };
  });

/* -------------------------------- close run -------------------------------- */

export const closeRun = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ context, data }) => {
    if (roleOf(context.user) === "Inspector") {
      throw Object.assign(new Error("Your role has read-only access."), { status: 403 });
    }
    const sdk = context.getBase44().asServiceRole;
    const who = nameOf(context.user);
    const run = await sdk.entities.SearchRun.get(data.runId);

    const articles = rows(await sdk.entities.Article.filter({ search_run: run.id }, { limit: 2000 }));
    const triages = rows(await sdk.entities.Triage.list({ limit: 2000 }));
    const decisions = rows(await sdk.entities.ReviewDecision.list({ limit: 2000 }));
    const decided = new Set(decisions.map((d) => d.article));
    const triageByArticle = new Map(triages.map((t) => [t.article, t]));

    const blockers = articles.filter((a) => {
      if (a.duplicate_of) return false;
      const triage = triageByArticle.get(a.id);
      if (!triage) return true;
      const requiresHuman = triage.category !== "Not Relevant" || triage.qc_sample;
      return requiresHuman && !decided.has(a.id);
    });

    if (blockers.length) {
      throw Object.assign(
        new Error(`${blockers.length} article${blockers.length === 1 ? "" : "s"} still need a human decision before this run can close.`),
        { status: 422 },
      );
    }

    const caseCount = rows(await sdk.entities.Case.list({ limit: 2000 })).filter((c) =>
      articles.some((a) => a.id === c.article),
    ).length;

    const updated = await sdk.entities.SearchRun.update(run.id, {
      status: "Closed",
      closed_by: who,
      closed_date: todayISO(),
      cases_created: caseCount,
    });

    await logAudit(sdk, {
      who,
      action: "Closed weekly run and generated the weekly search log",
      entity: "SearchRun",
      entity_id: run.id,
      before: { status: run.status },
      after: { status: "Closed", cases_created: caseCount },
    });

    return { run: updated, casesCreated: caseCount };
  });

/* -------------------------------- records -------------------------------- */

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      brand_name: z.string().min(1).max(200),
      active_ingredients: z.array(z.string()).default([]),
      synonyms: z.array(z.string()).default([]),
      product_type: z.enum(["Drug", "Natural Health Product"]),
      licence_number: z.string().max(60).optional(),
      division: z.enum(["Hospital", "Community"]).optional(),
      indication: z.string().max(1000).optional(),
      labelled_reactions: z.array(z.string()).default([]),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.user);
    const sdk = context.getBase44().asServiceRole;
    const { id, ...payload } = data;
    const saved = id
      ? await sdk.entities.Product.update(id, payload)
      : await sdk.entities.Product.create(payload);
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: id ? "Updated product" : "Added product",
      entity: "Product",
      entity_id: saved.id,
      after: { brand_name: saved.brand_name, active: saved.active },
    });
    return saved;
  });

export const saveStrategy = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      product: z.string(),
      database: z.enum(["PubMed", "Embase import", "Canada Vigilance import", "Other"]),
      query_string: z.string().min(1).max(4000),
      change_reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.user);
    const sdk = context.getBase44().asServiceRole;
    const who = nameOf(context.user);

    if (data.id) {
      const current = await sdk.entities.SearchStrategy.get(data.id);
      if (current.query_string.trim() !== data.query_string.trim()) {
        await sdk.entities.SearchStrategy.update(current.id, { active: false });
        const created = await sdk.entities.SearchStrategy.create({
          product: data.product,
          product_name: current.product_name,
          database: data.database,
          query_string: data.query_string,
          version: (Number(current.version) || 1) + 1,
          change_reason: data.change_reason || "Query updated",
          created_by: who,
          active: true,
        });
        await logAudit(sdk, {
          who,
          action: `Created search strategy version ${created.version}`,
          entity: "SearchStrategy",
          entity_id: created.id,
          before: { query_string: current.query_string, version: current.version },
          after: { query_string: created.query_string, version: created.version, reason: created.change_reason },
        });
        return created;
      }
      const updated = await sdk.entities.SearchStrategy.update(current.id, {
        database: data.database,
        change_reason: data.change_reason || current.change_reason,
      });
      await logAudit(sdk, {
        who,
        action: "Updated search strategy metadata",
        entity: "SearchStrategy",
        entity_id: updated.id,
        before: { database: current.database },
        after: { database: updated.database },
      });
      return updated;
    }

    const product = await sdk.entities.Product.get(data.product);
    const created = await sdk.entities.SearchStrategy.create({
      product: data.product,
      product_name: product.brand_name,
      database: data.database,
      query_string: data.query_string,
      version: 1,
      change_reason: data.change_reason || "Initial strategy",
      created_by: who,
      active: true,
    });
    await logAudit(sdk, {
      who,
      action: "Created search strategy",
      entity: "SearchStrategy",
      entity_id: created.id,
      after: { product: product.brand_name, query_string: created.query_string, version: 1 },
    });
    return created;
  });

export const saveCase = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      patch: z.record(z.string(), z.any()),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.Case.get(data.id);
    const updated = await sdk.entities.Case.update(data.id, data.patch);
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Updated case",
      entity: "Case",
      entity_id: data.id,
      before: { status: before.status, narrative: (before.narrative || "").slice(0, 300) },
      after: { status: updated.status, narrative: (updated.narrative || "").slice(0, 300) },
    });
    return updated;
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      search_frequency: z.enum(["Weekly", "Bi-weekly", "Monthly"]),
      confidence_threshold: z.number().min(0).max(100),
      qc_sample_percentage: z.number().min(0).max(100),
      email_alerts: z.boolean(),
      reviewer_email: z.string().optional(),
      deadline_alert_days: z.array(z.number()).default([5, 2]),
    }),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.user);
    const sdk = context.getBase44().asServiceRole;
    const { id, ...payload } = data;
    const saved = id
      ? await sdk.entities.AppSettings.update(id, payload)
      : await sdk.entities.AppSettings.create(payload);
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Updated settings",
      entity: "AppSettings",
      entity_id: saved.id,
      after: payload,
    });
    return saved;
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ userId: z.string(), pv_role: z.enum(["PV Associate", "Medical Reviewer", "Admin", "Inspector"]) }))
  .handler(async ({ context, data }) => {
    assertAdmin(context.user);
    const sdk = context.getBase44().asServiceRole;
    const updated = await sdk.entities.User.update(data.userId, { pv_role: data.pv_role });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Assigned role ${data.pv_role}`,
      entity: "User",
      entity_id: data.userId,
      after: { pv_role: data.pv_role },
    });
    return { id: updated.id, pv_role: updated.pv_role };
  });

export const sendDueCaseAlerts = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const sdk = context.getBase44().asServiceRole;
    const settings = rows(await sdk.entities.AppSettings.list({ limit: 1 }))[0] || {};
    if (settings.email_alerts === false) return { sent: 0, skipped: true };

    const alertDays = settings.deadline_alert_days?.length ? settings.deadline_alert_days : [5, 2];
    const cases = rows(await sdk.entities.Case.list({ limit: 1000 })).filter(
      (c) => c.due_date && !["Submitted", "Closed"].includes(c.status),
    );
    const today = todayISO();
    let sent = 0;

    for (const c of cases) {
      const daysLeft = Math.round((new Date(`${c.due_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
      if (!alertDays.includes(daysLeft)) continue;
      const recipients = await sendTemplated(
        sdk,
        "DeadlineAlert",
        {
          case_number: c.case_number,
          product_name: c.product_name || "company product",
          days_left: daysLeft,
          due_date: c.due_date,
        },
        settings,
        `Health Canada deadline in ${daysLeft} days: ${c.case_number}`,
      );
      sent += recipients.length;
    }

    if (sent) {
      await logAudit(sdk, {
        who: nameOf(context.user),
        action: `Sent ${sent} deadline alert email${sent === 1 ? "" : "s"}`,
        entity: "Case",
        entity_id: "",
      });
    }
    return { sent, skipped: false };
  });