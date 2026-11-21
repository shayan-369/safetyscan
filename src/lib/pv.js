export const PV_ROLES = ["PV Associate", "Medical Reviewer", "Admin", "Inspector"];

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

export const CASE_STATUS_TONE = {
  Draft: "slate",
  "Medical Review": "amber",
  "Ready to Submit": "teal",
  Submitted: "green",
  Closed: "navy",
};

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

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}