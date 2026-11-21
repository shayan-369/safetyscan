import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { addDaysISO, draftAnnualAnalysis, logAudit, summarizeForeignAction, todayISO, triageArticles } from "@/lib/pv.server";
import { evaluateReportability } from "@/lib/pv";
import { VALIDATION_SET } from "@/lib/validation-set";

const rows = (page) => (Array.isArray(page) ? page : page?.items ?? []);
const roleOf = (user) => user?.pv_role || (user?.role === "admin" ? "Admin" : "PV Associate");
const nameOf = (user) => user?.full_name || user?.email || "System";
const isMedical = (user) => ["Medical Reviewer", "Admin"].includes(roleOf(user));

function assertWriter(user) {
  if (roleOf(user) === "Inspector") throw Object.assign(new Error("Your role has read-only access."), { status: 403 });
}
function assertMedical(user) {
  if (!isMedical(user)) {
    throw Object.assign(new Error("A Medical Reviewer must make this decision."), { status: 403 });
  }
}

/* ------------------------------ day zero & assessment ------------------------------ */

export const setDayZero = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      checklist: z.object({
        day0_reporter: z.boolean(),
        day0_patient: z.boolean(),
        day0_product: z.boolean(),
        day0_reaction: z.boolean(),
      }),
      dayZero: z.string().optional(),
      reason: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.Case.get(data.id);
    const allMet = Object.values(data.checklist).every(Boolean);
    const dayZero = data.dayZero || (allMet ? before.day_zero || todayISO() : "");
    if (before.day_zero && dayZero !== before.day_zero && !data.reason?.trim()) {
      throw Object.assign(new Error("A written reason is required to change day zero."), { status: 422 });
    }
    const report = evaluateReportability({ ...before, ...data.checklist, day_zero: dayZero });
    const updated = await sdk.entities.Case.update(data.id, {
      ...data.checklist,
      day_zero: dayZero,
      day0_change_reason: data.reason || before.day0_change_reason || "",
      expectedness_effective: report.expectedness,
      expectedness_note: report.expectednessNote,
      reportable_to_health_canada: report.reportable,
      reportability_rule: report.rule,
      reportability_basis: `${report.rule}. ${report.expectednessNote}`.trim(),
      due_date: report.dueDate || "",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Updated the four minimum criteria and day zero",
      entity: "Case",
      entity_id: data.id,
      before: { day_zero: before.day_zero, reportable: before.reportable_to_health_canada },
      after: { ...data.checklist, day_zero: dayZero, reason: data.reason || "" },
    });
    return updated;
  });

export const changeSeriousness = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      seriousness: z.enum(["Serious", "Non-serious", "Unclear"]),
      criteria: z.array(z.string()).default([]),
      reason: z.string().min(5).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.Case.get(data.id);
    const report = evaluateReportability({ ...before, seriousness: data.seriousness });
    const updated = await sdk.entities.Case.update(data.id, {
      seriousness: data.seriousness,
      seriousness_criteria: data.criteria,
      seriousness_reason: data.reason,
      seriousness_changed_by: `${nameOf(context.user)} (${roleOf(context.user)})`,
      expectedness_effective: report.expectedness,
      expectedness_note: report.expectednessNote,
      reportable_to_health_canada: report.reportable,
      reportability_rule: report.rule,
      reportability_basis: `${report.rule}. ${report.expectednessNote}`.trim(),
      due_date: report.dueDate || "",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Medical Reviewer changed seriousness",
      entity: "Case",
      entity_id: data.id,
      before: { seriousness: before.seriousness, criteria: before.seriousness_criteria },
      after: { seriousness: data.seriousness, criteria: data.criteria, reason: data.reason },
    });
    return updated;
  });

export const changeExpectedness = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      expectedness: z.enum(["Expected", "Unexpected", "Unclear"]),
      reason: z.string().min(5).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.Case.get(data.id);
    const report = evaluateReportability({ ...before, expectedness: data.expectedness });
    const updated = await sdk.entities.Case.update(data.id, {
      expectedness: data.expectedness,
      expectedness_effective: report.expectedness,
      expectedness_note: report.expectednessNote,
      reportable_to_health_canada: report.reportable,
      reportability_rule: report.rule,
      reportability_basis: `${report.rule}. ${report.expectednessNote}`.trim(),
      due_date: report.dueDate || "",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Medical Reviewer changed expectedness",
      entity: "Case",
      entity_id: data.id,
      before: { expectedness: before.expectedness },
      after: { expectedness: data.expectedness, reason: data.reason },
    });
    return updated;
  });

/* ------------------------------ approval & submission ------------------------------ */

export const approveCase = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      signatureName: z.string().min(2).max(200),
      qualification: z.string().max(60),
      confirmed: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const record = await sdk.entities.Case.get(data.id);
    if (!record.full_text_status || record.full_text_status === "Requested") {
      if (!record.full_text_exempt_reason?.trim()) {
        throw Object.assign(
          new Error("Full text must be Received, or a reason must be recorded, before this case can be approved."),
          { status: 422 },
        );
      }
    }
    const approvedAt = new Date().toISOString();
    const updated = await sdk.entities.Case.update(data.id, {
      status: "Approved",
      approved_by: data.signatureName,
      approved_role: `${roleOf(context.user)}${data.qualification ? ` (${data.qualification})` : ""}`,
      approved_at: approvedAt,
      medical_assessment_confirmed: true,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Case approved with electronic signature by ${data.signatureName}`,
      entity: "Case",
      entity_id: data.id,
      before: { status: record.status },
      after: { status: "Approved", approved_by: data.signatureName, approved_at: approvedAt },
    });
    return updated;
  });

export const submitCase = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      method: z.enum(["Electronic E2B", "Paper - fax", "Paper - mail"]),
      date: z.string().min(8),
      acknowledgement: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const record = await sdk.entities.Case.get(data.id);
    if (record.status !== "Approved") {
      throw Object.assign(new Error("Only an approved case can be submitted to Health Canada."), { status: 422 });
    }
    if (!data.acknowledgement?.trim()) {
      throw Object.assign(new Error("Record the Health Canada acknowledgement or AER number."), { status: 422 });
    }
    const updated = await sdk.entities.Case.update(data.id, {
      status: "Submitted",
      submission_method: data.method,
      submitted_date: data.date,
      health_canada_ack: data.acknowledgement,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Case submitted to Health Canada",
      entity: "Case",
      entity_id: data.id,
      before: { status: record.status },
      after: { status: "Submitted", method: data.method, date: data.date, acknowledgement: data.acknowledgement },
    });
    return updated;
  });

/* ------------------------------ full text ------------------------------ */

export const saveFullText = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      articleId: z.string().optional(),
      caseId: z.string().optional(),
      status: z.enum(["Not needed", "Requested", "Received"]),
      fileUri: z.string().optional(),
      exemptReason: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    if (data.articleId) {
      const before = await sdk.entities.Article.get(data.articleId);
      await sdk.entities.Article.update(data.articleId, {
        full_text_status: data.status,
        full_text_file_uri: data.fileUri || before.full_text_file_uri || "",
      });
    }
    if (data.caseId) {
      await sdk.entities.Case.update(data.caseId, {
        full_text_status: data.status,
        full_text_exempt_reason: data.exemptReason || "",
      });
    }
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Full text marked ${data.status}`,
      entity: data.caseId ? "Case" : "Article",
      entity_id: data.caseId || data.articleId,
      after: { status: data.status, reason: data.exemptReason || "" },
    });
    return { status: data.status };
  });

/* ------------------------------ follow-ups & versions ------------------------------ */

export const createFollowUp = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      caseId: z.string(),
      type: z.enum(["Author contact", "Full text", "Translation", "Other"]),
      dateRequested: z.string().min(8),
      method: z.string().max(120).optional(),
      sentTo: z.string().max(300).optional(),
      responseDate: z.string().optional(),
      outcome: z.enum(["Awaiting reply", "Received", "No reply", "Refused", "Closed"]),
      significantNewInfo: z.enum(["yes", "no"]),
      notes: z.string().max(4000).optional(),
      receivedDate: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const who = nameOf(context.user);
    const record = await sdk.entities.Case.get(data.caseId);

    const followUp = await sdk.entities.FollowUp.create({
      case: record.id,
      type: data.type,
      date_requested: data.dateRequested,
      method: data.method || "",
      sent_to: data.sentTo || "",
      response_date: data.responseDate || "",
      outcome: data.outcome,
      significant_new_info: data.significantNewInfo,
      notes: data.notes || "",
      logged_by: who,
    });

    let newVersion = null;
    if (data.significantNewInfo === "yes") {
      const received = data.receivedDate || data.responseDate || todayISO();
      if (record.received_date && received < record.received_date) {
        throw Object.assign(new Error("The new version received date cannot be earlier than the previous version."), {
          status: 422,
        });
      }
      const initial = record.initial_case || record.id;
      const family = rows(await sdk.entities.Case.list({ limit: 2000 })).filter(
        (c) => c.id === initial || c.initial_case === initial,
      );
      const version = Math.max(record.version || 1, ...family.map((c) => Number(c.version) || 1)) + 1;
      const narrative = [record.narrative || "", `Follow-up received ${received}: ${data.notes || "significant new information"}`]
        .filter(Boolean)
        .join("\n\n");
      const report = evaluateReportability({ ...record, day_zero: received });

      const carried = { ...record };
      delete carried.id;
      delete carried.created_date;
      delete carried.updated_date;
      delete carried.created_by_id;

      newVersion = await sdk.entities.Case.create({
        ...carried,
        case_number: record.case_number,
        version,
        initial_case: initial,
        previous_version: record.id,
        received_date: received,
        day_zero: received,
        due_date: report.dueDate || "",
        narrative,
        status: "Follow-up",
        approved_by: "",
        approved_role: "",
        approved_at: "",
        medical_assessment_confirmed: false,
        submitted_date: "",
        health_canada_ack: "",
        submission_method: undefined,
      });

      if (!["Submitted", "Closed"].includes(record.status)) {
        await sdk.entities.Case.update(record.id, { status: "Follow-up" });
      }
      await logAudit(sdk, {
        who,
        action: `Significant new information created case version ${version} and restarted the 15-day clock`,
        entity: "Case",
        entity_id: newVersion.id,
        before: { version: record.version || 1, due_date: record.due_date },
        after: { version, received_date: received, due_date: newVersion.due_date },
      });
    }

    await logAudit(sdk, {
      who,
      action: `${data.type} follow-up logged (${data.outcome})`,
      entity: "FollowUp",
      entity_id: followUp.id,
      after: { case: record.case_number, outcome: data.outcome, significant: data.significantNewInfo },
    });

    return { followUp, newVersionId: newVersion?.id || null, version: newVersion?.version || record.version || 1 };
  });

/* ------------------------------ environmental scanning ------------------------------ */

export const addScan = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      runId: z.string().optional(),
      date: z.string().min(8),
      source: z.enum([
        "PubMed",
        "Embase",
        "Canada Vigilance online database",
        "FDA",
        "EMA",
        "MHRA",
        "Other foreign regulator",
        "Local journal",
      ]),
      queryChecked: z.string().min(2).max(2000),
      dateRangeStart: z.string().optional(),
      dateRangeEnd: z.string().optional(),
      resultCount: z.number().min(0).max(100000),
      outcome: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const created = await sdk.entities.ScanLog.create({
      search_run: data.runId || "",
      date: data.date,
      source: data.source,
      query_checked: data.queryChecked,
      date_range_start: data.dateRangeStart || "",
      date_range_end: data.dateRangeEnd || "",
      result_count: data.resultCount,
      outcome: data.outcome || "",
      performed_by: nameOf(context.user),
      optional_note:
        data.source === "Canada Vigilance online database"
          ? "Optional for case reporting, recommended for the Annual Summary Report"
          : "",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Environmental scan logged: ${data.source}`,
      entity: "ScanLog",
      entity_id: created.id,
      after: { source: data.source, result_count: data.resultCount, outcome: data.outcome || "" },
    });
    return created;
  });

export const attachRunLog = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ runId: z.string(), fileUri: z.string().min(3) }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    await sdk.entities.SearchRun.update(data.runId, { log_file_uri: data.fileUri });
    return { ok: true };
  });

/* ------------------------------ foreign actions ------------------------------ */

export const saveForeignAction = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      authority: z.string().min(2).max(120),
      awarenessDate: z.string().min(8),
      product: z.string(),
      summary: z.string().min(5).max(6000),
      noticeText: z.string().max(8000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const product = data.product ? await sdk.entities.Product.get(data.product) : null;
    const due = `${addDaysISO(data.awarenessDate, 3)}`;
    const payload = {
      authority: data.authority,
      awareness_date: data.awarenessDate,
      product: data.product,
      product_name: product?.brand_name || "",
      summary: data.summary,
      due_date: due,
      status: "Open",
    };
    const saved = data.id
      ? await sdk.entities.ForeignAction.update(data.id, payload)
      : await sdk.entities.ForeignAction.create(payload);
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: data.id ? "Updated foreign regulatory action" : "Recorded foreign regulatory action",
      entity: "ForeignAction",
      entity_id: saved.id,
      after: { authority: data.authority, product: product?.brand_name, awareness: data.awarenessDate },
    });
    return saved;
  });

export const summarizeNotice = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ authority: z.string().max(120), productName: z.string().max(200), text: z.string().min(20).max(8000) }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    return summarizeForeignAction(sdk, { authority: data.authority, productName: data.productName, text: data.text });
  });

export const decideForeignAction = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      seriousRisk: z.enum(["yes", "no", "unclear"]),
      rationale: z.string().min(5).max(2000),
      notifiedDate: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.ForeignAction.get(data.id);
    const updated = await sdk.entities.ForeignAction.update(data.id, {
      serious_risk_to_canada: data.seriousRisk,
      relevance_rationale: data.rationale,
      relevance_decided_by: `${nameOf(context.user)} (${roleOf(context.user)})`,
      notified_date: data.notifiedDate || before.notified_date || "",
      status: data.notifiedDate ? "Notified" : before.status,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Medical Reviewer decided foreign action relevance",
      entity: "ForeignAction",
      entity_id: data.id,
      before: { serious_risk_to_canada: before.serious_risk_to_canada },
      after: { serious_risk_to_canada: data.seriousRisk, rationale: data.rationale, notified: data.notifiedDate || "" },
    });
    return updated;
  });

/* ------------------------------ signals ------------------------------ */

export const openSignal = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      productId: z.string(),
      reaction: z.string().min(2).max(200),
      assessment: z.string().max(3000).optional(),
      source: z.enum(["Auto flag", "Manual"]).default("Auto flag"),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const product = await sdk.entities.Product.get(data.productId);
    const created = await sdk.entities.Signal.create({
      product: product.id,
      product_name: product.brand_name,
      reaction: data.reaction,
      source: data.source,
      status: "Open",
      assessment: data.assessment || "",
      opened_date: todayISO(),
      owner: nameOf(context.user),
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Signal opened for ${data.reaction}`,
      entity: "Signal",
      entity_id: created.id,
      after: { product: product.brand_name, reaction: data.reaction },
    });
    return created;
  });

export const saveSignal = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["New", "Open", "Ongoing", "Closed - refuted", "Closed - confirmed"]),
      assessment: z.string().max(4000).optional(),
      actions: z.string().max(4000).optional(),
      owner: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.Signal.get(data.id);
    const closing = data.status.startsWith("Closed");
    const updated = await sdk.entities.Signal.update(data.id, {
      status: data.status,
      assessment: data.assessment ?? before.assessment,
      actions: data.actions ?? before.actions,
      owner: data.owner ?? before.owner,
      closed_date: closing ? before.closed_date || todayISO() : "",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Signal ${data.status}`,
      entity: "Signal",
      entity_id: data.id,
      before: { status: before.status },
      after: { status: data.status },
    });
    return updated;
  });

/* ------------------------------ annual summary report ------------------------------ */

export const buildAnnualReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ productId: z.string(), lockPoint: z.string().min(8) }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const product = await sdk.entities.Product.get(data.productId);
    const end = data.lockPoint;
    const start = addDaysISO(end, -364);

    const allCases = rows(await sdk.entities.Case.list({ limit: 2000 })).filter(
      (c) => c.product === product.id && !c.nullified,
    );
    const inPeriod = allCases.filter((c) => {
      const received = c.received_date || c.day_zero || (c.created_date || "").slice(0, 10);
      return received >= start && received <= end;
    });
    const signals = rows(await sdk.entities.Signal.list({ limit: 500 })).filter((s) => s.product === product.id);
    const specials = [...new Set(inPeriod.flatMap((c) => c.special_situations || []))];

    const lineListing = inPeriod
      .map(
        (c) =>
          `${c.case_number} v${c.version || 1} · ${c.patient_initials_or_descriptor || "patient"} · ${(c.reactions || []).join(", ")} · ${c.seriousness} · ${c.expectedness_effective || c.expectedness} · ${c.occurred_in}`,
      )
      .join("\n");
    const literature = inPeriod
      .map((c) => `- ${c.case_number}: literature report${c.reportability_rule ? ` · ${c.reportability_rule}` : ""}`)
      .join("\n");

    const analysis = await draftAnnualAnalysis(sdk, {
      productName: product.brand_name,
      periodStart: start,
      periodEnd: end,
      cases: inPeriod,
      signals,
      specialSituations: specials,
    });

    const payload = {
      product: product.id,
      product_name: product.brand_name,
      period_start: start,
      period_end: end,
      due_date: addDaysISO(end, 70),
      status: "Draft",
      line_listing: lineListing,
      literature_findings: literature,
      signals_summary: signals.map((s) => `${s.reaction} · ${s.status}`).join("\n"),
      special_situations_summary: specials.join(", "),
      label_changes: "",
      critical_analysis: analysis,
    };

    const existing = rows(await sdk.entities.AnnualReport.filter({ product: product.id, period_end: end }, { limit: 1 }))[0];
    const saved = existing
      ? await sdk.entities.AnnualReport.update(existing.id, payload)
      : await sdk.entities.AnnualReport.create(payload);

    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Annual Summary Report data collected and AI critical analysis drafted",
      entity: "AnnualReport",
      entity_id: saved.id,
      after: { product: product.brand_name, period: `${start} to ${end}`, cases: inPeriod.length },
    });
    return saved;
  });

export const signAnnualReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      significantChange: z.enum(["yes", "no"]),
      rationale: z.string().min(10).max(4000),
      signatureName: z.string().min(2).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.AnnualReport.get(data.id);
    const signedAt = new Date().toISOString();
    const updated = await sdk.entities.AnnualReport.update(data.id, {
      significant_change: data.significantChange,
      rationale: data.rationale,
      signed_by: data.signatureName,
      signed_role: roleOf(context.user),
      signed_at: signedAt,
      status: "Signed",
    });

    if (data.significantChange === "yes") {
      await sdk.entities.Task.create({
        title: "Notify Health Canada without delay",
        description: `Significant change in benefit-risk identified in the Annual Summary Report for ${before.product_name}.`,
        kind: "Notify Health Canada",
        due_date: todayISO(),
        status: "Open",
        owner: nameOf(context.user),
      });
    }

    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Annual Summary Report signed by Medical Reviewer",
      entity: "AnnualReport",
      entity_id: data.id,
      before: { status: before.status },
      after: {
        status: "Signed",
        significant_change: data.significantChange,
        signature: data.signatureName,
        signed_at: signedAt,
      },
    });
    return updated;
  });

/* ------------------------------ validation ------------------------------ */

export const runValidation = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const [articlePage, productPage, settingsPage, decisionPage] = await Promise.all([
      sdk.entities.Article.list({ limit: 1000 }),
      sdk.entities.Product.list({ limit: 200 }),
      sdk.entities.AppSettings.list({ limit: 1 }),
      sdk.entities.ReviewDecision.list({ limit: 2000 }),
    ]);
    const articles = rows(articlePage);
    const products = rows(productPage);
    const settings = rows(settingsPage)[0] || {};

    const matched = VALIDATION_SET.map((test) => ({
      test,
      article: articles.find((a) => (a.title || "").toLowerCase().includes(test.match.toLowerCase())),
    })).filter((entry) => entry.article);

    const triaged = matched.length
      ? await triageArticles(
          sdk,
          matched.map((entry, index) => ({
            index,
            title: entry.article.title,
            abstract: entry.article.abstract,
            journal: entry.article.journal,
            products: products.filter((p) => (entry.article.matched_products || []).includes(p.id)),
          })),
          Number(settings.confidence_threshold) || 85,
        )
      : [];

    const results = [];
    matched.forEach((entry, index) => {
      const actual = triaged.find((t) => Number(t.index) === index) || {};
      const checks = Object.entries(entry.test.expected).map(([field, expected]) => {
        const value =
          field === "patients"
            ? (actual.patients || []).length
            : field === "special_situation"
              ? (actual.special_situations || []).includes(expected)
              : actual[field];
        return { field, expected, actual: value, pass: String(value) === String(expected) };
      });
      results.push({ title: entry.article.title, checks });
    });

    const totalFields = results.reduce((sum, r) => sum + r.checks.length, 0);
    const passedFields = results.reduce((sum, r) => sum + r.checks.filter((c) => c.pass).length, 0);
    const decisions = rows(decisionPage);
    const confirmed = decisions.filter((d) => d.decision === "Confirm AI").length;
    const agreement = decisions.length ? Math.round((confirmed / decisions.length) * 100) : 0;

    const saved = await sdk.entities.ValidationRun.create({
      run_date: new Date().toISOString(),
      prompt_version: triaged[0]?.prompt_version || settings.triage_prompt_version || "unknown",
      ai_model: triaged[0]?.ai_model || settings.ai_model || "automatic",
      total_fields: totalFields,
      passed_fields: passedFields,
      accuracy: totalFields ? Math.round((passedFields / totalFields) * 1000) / 10 : 0,
      results: JSON.stringify(results).slice(0, 60000),
      agreement_rate: agreement,
      override_rate: 100 - agreement,
      performed_by: nameOf(context.user),
    });

    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "AI validation suite executed against the fixed test set",
      entity: "ValidationRun",
      entity_id: saved.id,
      after: { accuracy: saved.accuracy, articles: results.length, prompt_version: saved.prompt_version },
    });
    return { run: saved, results };
  });

/* ------------------------------ retention & control ------------------------------ */

const NULLIFIABLE = ["Case", "Article", "Triage", "ReviewDecision", "FollowUp", "ScanLog"];

export const nullifyRecord = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      entity: z.enum(["Case", "Article", "Triage", "ReviewDecision", "FollowUp", "ScanLog"]),
      id: z.string(),
      reason: z.string().min(5).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    if (!NULLIFIABLE.includes(data.entity)) throw Object.assign(new Error("This record cannot be nullified."), { status: 400 });
    const sdk = context.getBase44().asServiceRole;
    const updated = await sdk.entities[data.entity].update(data.id, {
      nullified: true,
      nullified_reason: data.reason,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Record nullified (retained, not deleted)`,
      entity: data.entity,
      entity_id: data.id,
      after: { nullified_reason: data.reason },
    });
    return updated;
  });

export const requestTriageChange = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      area: z.enum(["Triage prompt", "Confidence threshold", "AI model", "Search frequency"]),
      change: z.string().min(2).max(400),
      reason: z.string().min(5).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const created = await sdk.entities.ChangeLog.create({
      area: data.area,
      change: data.change,
      reason: data.reason,
      requested_by: nameOf(context.user),
      status: "Pending approval",
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Requested ${data.area} change`,
      entity: "ChangeLog",
      entity_id: created.id,
      after: { change: data.change, reason: data.reason },
    });
    return created;
  });

export const approveTriageChange = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), signatureName: z.string().min(2).max(200) }))
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const before = await sdk.entities.ChangeLog.get(data.id);
    const approvedAt = new Date().toISOString();
    const updated = await sdk.entities.ChangeLog.update(data.id, {
      status: "Approved",
      approved_by: data.signatureName,
      approved_role: roleOf(context.user),
      approved_at: approvedAt,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: `Medical Reviewer approved ${before.area} change`,
      entity: "ChangeLog",
      entity_id: data.id,
      before: { status: before.status },
      after: { status: "Approved", signature: data.signatureName, approved_at: approvedAt },
    });
    return updated;
  });

export const setReviewerQualification = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      userId: z.string(),
      qualification: z.enum(["Physician", "Pharmacist", "Nurse", "Other"]),
      detail: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertMedical(context.user);
    const sdk = context.getBase44().asServiceRole;
    const updated = await sdk.entities.User.update(data.userId, {
      pv_qualification: data.detail ? `${data.qualification} - ${data.detail}` : data.qualification,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Recorded Medical Reviewer qualification",
      entity: "User",
      entity_id: data.userId,
      after: { pv_qualification: updated.pv_qualification },
    });
    return { id: updated.id, pv_qualification: updated.pv_qualification };
  });

export const savePvAgreement = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      productId: z.string(),
      imported: z.boolean(),
      partnerCompany: z.string().max(200).optional(),
      screensLiterature: z.enum(["Seaford", "Partner", "Both"]),
      reportsToHc: z.enum(["Seaford", "Partner"]),
      effectiveDate: z.string().optional(),
      fileUri: z.string().optional(),
      daysToExchange: z.number().min(0).max(365).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (roleOf(context.user) !== "Admin") {
      throw Object.assign(new Error("Only an Admin can change the PV agreement."), { status: 403 });
    }
    const sdk = context.getBase44().asServiceRole;
    const updated = await sdk.entities.Product.update(data.productId, {
      imported: data.imported,
      partner_company: data.partnerCompany || "",
      screens_literature: data.screensLiterature,
      reports_to_hc: data.reportsToHc,
      agreement_effective_date: data.effectiveDate || "",
      agreement_file_uri: data.fileUri || "",
      partner_days_to_exchange: data.daysToExchange ?? 0,
    });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Updated the PV agreement",
      entity: "Product",
      entity_id: data.productId,
      after: { partner: data.partnerCompany, screens: data.screensLiterature, reports: data.reportsToHc },
    });
    return updated;
  });

export const closeTask = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const updated = await sdk.entities.Task.update(data.id, { status: "Done" });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Task closed",
      entity: "Task",
      entity_id: data.id,
    });
    return updated;
  });

export const markArticleInReview = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ articleId: z.string() }))
  .handler(async ({ context, data }) => {
    assertWriter(context.user);
    const sdk = context.getBase44().asServiceRole;
    const article = await sdk.entities.Article.get(data.articleId);
    if (article.status === "In Review" || article.status === "Decided") return { status: article.status };
    const updated = await sdk.entities.Article.update(data.articleId, { status: "In Review" });
    await logAudit(sdk, {
      who: nameOf(context.user),
      action: "Article opened in the review queue",
      entity: "Article",
      entity_id: data.articleId,
      before: { status: article.status },
      after: { status: "In Review" },
    });
    return { status: updated.status };
  });