export const PV_ROLES = ["PV Associate", "Medical Reviewer", "Admin", "Inspector"];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function pvRoleOf(user) {
  return user?.pv_role || (user?.role === "admin" ? "Admin" : "PV Associate");
}

export const CATEGORY_ORDER = [
  "Potential Reportable Case",
  "Safety Information/Possible Signal",
  "Not Relevant",
];

export const CATEGORY_TONE = {
  "Potential Reportable Case": "red",
  "Safety Information/Possible Signal": "amber",
  "Not Relevant": "slate",
};

export const SERIOUSNESS_TONE = {
  Serious: "red",
  "Non-serious": "slate",
  Unclear: "amber",
};

export const EXPECTEDNESS_TONE = {
  Expected: "slate",
  Unexpected: "amber",
  Unclear: "amber",
};

export const NOT_RELEVANT_REASONS = [
  "Animal or lab study",
  "Different product or ingredient",
  "No adverse event",
  "Review article with no new cases",
  "Other",
];

export const SERIOUSNESS_CRITERIA = [
  "Death",
  "Life-threatening",
  "Hospitalization",
  "Disability",
  "Congenital anomaly",
  "Medically important",
];

export const RUN_STATUS_TONE = {
  Running: "teal",
  "Awaiting Review": "amber",
  Completed: "navy",
  Closed: "green",
};

export const CASE_STATUSES = ["Draft", "Medical Review", "Approved", "Submitted", "Follow-up", "Closed"];

export const CASE_STATUS_TONE = {
  Draft: "slate",
  "Medical Review": "amber",
  Approved: "teal",
  "Ready to Submit": "teal",
  Submitted: "purple",
  "Follow-up": "amber",
  Closed: "navy",
};

export const EXCLUSION_REASONS = [
  "Country of marketing",
  "Product name",
  "Active ingredient",
  "Pharmaceutical form",
  "Batch number",
  "Marketing status",
  "Other",
];

export const SPECIAL_SITUATIONS = [
  "Pregnancy or breastfeeding exposure",
  "Medication error",
  "Misuse or abuse",
  "Off-label use",
  "Overdose",
  "Lack of efficacy",
  "Drug interaction",
];

export const SCAN_SOURCES = [
  "PubMed",
  "Embase",
  "Canada Vigilance online database",
  "FDA",
  "EMA",
  "MHRA",
  "Other foreign regulator",
  "Local journal",
];

export const FOLLOWUP_TYPES = ["Author contact", "Full text", "Translation", "Other"];

export const SIGNAL_STATUSES = ["New", "Open", "Ongoing", "Closed - refuted", "Closed - confirmed"];

export const MINIMUM_CRITERIA = [
  { key: "day0_reporter", label: "Identifiable reporter" },
  { key: "day0_patient", label: "Identifiable patient" },
  { key: "day0_product", label: "Suspect product" },
  { key: "day0_reaction", label: "Adverse reaction" },
];

const FALSY = ["", "unknown", "not reported", "n/a", "none"];

/**
 * Expectedness used for reportability. "Unclear" is treated as Unexpected,
 * and a fatal outcome is Unexpected unless the label says the reaction can be fatal.
 */
export function resolveExpectedness(record = {}, product = null) {
  const labelled = (product?.labelled_reactions || []).map((r) => String(r).toLowerCase()).filter(Boolean);
  const reactions = (record.reactions || []).map((r) => String(r).toLowerCase()).filter(Boolean);
  const labelIncomplete = labelled.length === 0;
  const fatalLabelled = labelled.some((r) => /fatal|death|lethal|decease/.test(r));
  const matchedInLabel =
    !labelIncomplete && reactions.length > 0 && reactions.every((r) => labelled.some((l) => l.includes(r) || r.includes(l)));

  if (record.fatal_outcome && !fatalLabelled) {
    return {
      effective: "Unexpected",
      note: "Fatal outcome is treated as unexpected because the label does not state the reaction can be fatal",
      labelIncomplete,
    };
  }
  if (record.expectedness === "Unclear" || !record.expectedness) {
    return { effective: "Unexpected", note: "Treated as unexpected (uncertain)", labelIncomplete };
  }
  if (record.expectedness === "Expected" && (labelIncomplete || !matchedInLabel)) {
    return {
      effective: "Unexpected",
      note: labelIncomplete
        ? "Label reactions incomplete, so every reaction is treated as unexpected"
        : "Reaction is not described in the Canadian label, so it is treated as unexpected",
      labelIncomplete,
    };
  }
  return { effective: record.expectedness, note: "", labelIncomplete };
}

/** Which Health Canada reporting rule applies to this case. */
export function evaluateReportability(record = {}, product = null) {
  const expected = resolveExpectedness(record, product);
  const serious = record.seriousness === "Serious";
  const canada = record.occurred_in === "Canada";
  const foreign = record.occurred_in === "Foreign";
  const sameCombination = record.market_same_combination !== false;

  let rule = "Not reportable within 15 days";
  let reportable = false;

  if (!serious) {
    rule = "Not reportable: not serious";
  } else if (canada) {
    reportable = true;
    rule = "Serious Canadian case (expected or unexpected)";
  } else if (foreign && expected.effective === "Unexpected" && sameCombination) {
    reportable = true;
    rule = "Serious foreign case, unexpected, same active-ingredient combination marketed in Canada";
  } else if (foreign) {
    rule = sameCombination
      ? "Not reportable: serious foreign case but expected"
      : "Not reportable: serious foreign case and we do not market the same active-ingredient combination in Canada";
  } else {
    rule = "Not reportable: country of the reaction is unknown";
  }

  return {
    reportable,
    rule,
    expectedness: expected.effective,
    expectednessNote: expected.note,
    labelIncomplete: expected.labelIncomplete,
    sameCombination,
    dueDate: reportable && record.day_zero ? toDateInput(addDays(new Date(record.day_zero), 15)) : null,
  };
}

export function criteriaMet(record = {}) {
  return MINIMUM_CRITERIA.every((criterion) => record[criterion.key] === true);
}

/** Dice coefficient over character bigrams, used for fuzzy title de-duplication. */
export function titleSimilarity(a = "", b = "") {
  const norm = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const grams = (value) => {
    const map = new Map();
    for (let i = 0; i < value.length - 1; i += 1) {
      const gram = value.slice(i, i + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };
  const first = grams(left);
  const second = grams(right);
  let overlap = 0;
  first.forEach((count, gram) => {
    overlap += Math.min(count, second.get(gram) || 0);
  });
  return (2 * overlap) / (left.length - 1 + right.length - 1);
}

export const isBlank = (value) => FALSY.includes(String(value ?? "").trim().toLowerCase());

export const SOURCE_DATABASES = ["PubMed", "Embase import", "Canada Vigilance import", "Other"];

export function formatDate(value, fallback = "—") {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole days from today until `date` (negative when overdue). */
export function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t1 - t0) / 86400000);
}

/** Health Canada 15-day clock: serious + (Canadian or unexpected). */
export function computeDueDate({ seriousness, occurred_in, expectedness, dayZero }) {
  const serious = seriousness === "Serious";
  const qualifies = occurred_in === "Canada" || expectedness === "Unexpected";
  if (!serious || !qualifies || !dayZero) return null;
  return toDateInput(addDays(new Date(dayZero), 15));
}

/** Gaps between consecutive runs, so coverage never silently skips a period. */
export function findRunGaps(runs) {
  const ordered = [...runs]
    .filter((r) => r.date_range_start && r.date_range_end)
    .sort((a, b) => new Date(a.date_range_start) - new Date(b.date_range_start));
  const gaps = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const previousEnd = new Date(`${ordered[i - 1].date_range_end}T00:00:00Z`);
    const nextStart = new Date(`${ordered[i].date_range_start}T00:00:00Z`);
    const expected = new Date(previousEnd);
    expected.setUTCDate(expected.getUTCDate() + 1);
    if (nextStart > expected) gaps.push({ from: ordered[i - 1].date_range_end, to: ordered[i].date_range_start });
  }
  return gaps;
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}