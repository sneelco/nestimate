import { uid } from "./format.js";
import {
  ACCOUNT_TYPES, AMOUNT_TYPES, FREQS, TAX_TYPES, defaultPlan, defaultTax, defaultDrawdown, guessTaxType,
} from "./plan.js";

export const PLAN_KEY = "nestimate.plan.v1";
export const THEME_KEY = "nestimate.theme";
export const FILE_FORMAT = "nestimate-plan";
export const FILE_VERSION = 1;

/* ---------- validation / normalization ----------
   Everything that comes from disk or a file goes through normalizePlan so the
   app can trust the shape. Bad or missing fields fall back to safe defaults;
   only a structurally hopeless document is rejected. */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const numOrBlank = (v, fallback = "") => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const idOf = (v) => (typeof v === "string" && v.length > 0 ? v : uid());

// Age references: "" (open), "@<keyId>", or a number-like value.
const ageRef = (v, keyIds) => {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "string" && v.startsWith("@")) return keyIds.has(v.slice(1)) ? v : "";
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : "";
};

function normalizeSchedule(raw, accountType, keyIds) {
  if (!isObj(raw)) return null;
  const allowedKinds = accountType === "balance" ? ["contribution", "withdrawal"] : ["payment"];
  const kind = oneOf(raw.kind, allowedKinds, allowedKinds[0]);
  return {
    id: idOf(raw.id),
    kind,
    amount: numOrBlank(raw.amount),
    amountType: kind === "withdrawal" ? oneOf(raw.amountType, AMOUNT_TYPES, "fixed") : "fixed",
    freq: oneOf(raw.freq, FREQS.map((f) => f.id), "monthly"),
    startAge: ageRef(raw.startAge, keyIds),
    endAge: ageRef(raw.endAge, keyIds),
  };
}

function normalizeAccount(raw, keyIds) {
  if (!isObj(raw)) return null;
  const type = oneOf(raw.type, ACCOUNT_TYPES, "balance");
  const schedules = Array.isArray(raw.schedules)
    ? raw.schedules.map((s) => normalizeSchedule(s, type, keyIds)).filter(Boolean)
    : [];
  const base = { id: idOf(raw.id), name: str(raw.name, "Account"), type, schedules };
  if (type === "balance") {
    const taxIds = TAX_TYPES.map((t) => t.id);
    return {
      ...base,
      taxType: oneOf(raw.taxType, taxIds, guessTaxType(base.name)),
      drawdown: raw.drawdown !== false,
      balance: numOrBlank(raw.balance, 0),
      growth: numOrBlank(raw.growth, 0),
    };
  }
  const taxablePct = numOrBlank(raw.taxablePct, 100);
  return { ...base, cola: numOrBlank(raw.cola, 0), taxablePct: Math.min(100, Math.max(0, taxablePct)) };
}

function normalizeSpending(raw, keyIds) {
  if (!isObj(raw)) return null;
  return {
    id: idOf(raw.id),
    name: str(raw.name),
    amount: numOrBlank(raw.amount),
    freq: oneOf(raw.freq, FREQS.map((f) => f.id), "monthly"),
    increase: numOrBlank(raw.increase, 0),
    startAge: ageRef(raw.startAge, keyIds),
    endAge: ageRef(raw.endAge, keyIds),
  };
}

function normalizeTax(raw) {
  const d = defaultTax();
  if (!isObj(raw)) return d;
  return {
    incomeRate: numOrBlank(raw.incomeRate, d.incomeRate),
    gainsRate: numOrBlank(raw.gainsRate, d.gainsRate),
    rmd: raw.rmd !== false,
  };
}

function normalizeDrawdown(raw) {
  const d = defaultDrawdown();
  if (!isObj(raw)) return d;
  return { enabled: raw.enabled !== false };
}

/** Returns a clean plan, or throws an Error describing why the input is unusable. */
export function normalizePlan(raw) {
  if (!isObj(raw)) throw new Error("Plan must be an object.");
  if (!Array.isArray(raw.accounts)) throw new Error("Plan is missing an \"accounts\" list.");

  const keyAges = (Array.isArray(raw.keyAges) ? raw.keyAges : [])
    .filter(isObj)
    .map((k) => ({ id: idOf(k.id), name: str(k.name), age: numOrBlank(k.age) }));
  const keyIds = new Set(keyAges.map((k) => k.id));

  const birthday = str(raw.birthday);
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new Error("Birthday must be YYYY-MM-DD.");

  return {
    birthday,
    endAge: numOrBlank(raw.endAge, 95),
    keyAges,
    accounts: raw.accounts.map((a) => normalizeAccount(a, keyIds)).filter(Boolean),
    spending: (Array.isArray(raw.spending) ? raw.spending : []).map((sp) => normalizeSpending(sp, keyIds)).filter(Boolean),
    tax: normalizeTax(raw.tax),
    drawdown: normalizeDrawdown(raw.drawdown),
  };
}

/* ---------- localStorage ---------- */
function safeStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // storage disabled (private mode, blocked cookies, etc.)
  }
}

export function loadPlan() {
  const s = safeStorage();
  if (!s) return null;
  try {
    const text = s.getItem(PLAN_KEY);
    return text ? normalizePlan(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function savePlan(plan) {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(PLAN_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

export function clearPlan() {
  const s = safeStorage();
  if (!s) return;
  try { s.removeItem(PLAN_KEY); } catch { /* ignore */ }
}

export function loadTheme() {
  const s = safeStorage();
  if (!s) return null;
  try {
    const v = s.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function saveTheme(mode) {
  const s = safeStorage();
  if (!s) return;
  try { s.setItem(THEME_KEY, mode); } catch { /* ignore */ }
}

/* ---------- import / export ---------- */
export function serializePlan(plan, now = new Date()) {
  return JSON.stringify(
    { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), plan },
    null,
    2,
  );
}

/** Accepts either a wrapped export document or a bare plan object. */
export function parsePlanFile(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (isObj(doc) && doc.format === FILE_FORMAT) {
    if (typeof doc.version === "number" && doc.version > FILE_VERSION) {
      throw new Error(`This file was made by a newer version of Nestimate (format v${doc.version}).`);
    }
    return normalizePlan(doc.plan);
  }
  return normalizePlan(doc);
}

export function exportFileName(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return `nestimate-plan-${d}.json`;
}

export function downloadPlan(plan) {
  const blob = new Blob([serializePlan(plan)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { defaultPlan };
