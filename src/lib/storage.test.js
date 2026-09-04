import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizePlan, parsePlanFile, serializePlan, exportFileName,
  loadPlan, savePlan, clearPlan, loadTheme, saveTheme, PLAN_KEY, defaultPlan,
} from "./storage.js";

describe("normalizePlan", () => {
  it("accepts the default plan unchanged", () => {
    const plan = defaultPlan();
    expect(normalizePlan(plan)).toEqual(plan);
  });

  it("rejects non-plans", () => {
    expect(() => normalizePlan(null)).toThrow();
    expect(() => normalizePlan("hi")).toThrow();
    expect(() => normalizePlan({})).toThrow(/accounts/);
    expect(() => normalizePlan({ accounts: [], birthday: "June 1985" })).toThrow(/YYYY-MM-DD/);
  });

  it("fills in safe defaults for junk fields", () => {
    const plan = normalizePlan({
      birthday: "1980-01-01",
      endAge: "lots",
      keyAges: [{ name: "Retire", age: "62" }, "garbage"],
      accounts: [
        { name: "X", type: "weird", balance: "1e5", growth: null,
          schedules: [{ kind: "payment", amount: "12", freq: "daily", startAge: "@missing", endAge: "70" }, 7] },
        { type: "income", cola: 2, schedules: [{ kind: "withdrawal", amount: 5 }] },
        null,
      ],
    });
    expect(plan.endAge).toBe(95);
    expect(plan.keyAges).toHaveLength(1);
    expect(plan.keyAges[0]).toMatchObject({ name: "Retire", age: 62 });
    expect(typeof plan.keyAges[0].id).toBe("string");
    expect(plan.accounts).toHaveLength(2);

    const [a, b] = plan.accounts;
    expect(a).toMatchObject({ name: "X", type: "balance", balance: 100000, growth: 0 });
    expect(a.schedules).toHaveLength(1);
    // "payment" is not valid on a balance account; falls back to contribution.
    expect(a.schedules[0]).toMatchObject({ kind: "contribution", amount: 12, freq: "monthly", startAge: "", endAge: 70 });

    expect(b).toMatchObject({ name: "Account", type: "income", cola: 2 });
    expect(b.schedules[0].kind).toBe("payment");
    expect(b).not.toHaveProperty("balance");
  });

  it("keeps key-age references that resolve", () => {
    const plan = normalizePlan({
      keyAges: [{ id: "k1", name: "R", age: 60 }],
      accounts: [{ id: "a", type: "balance", schedules: [{ kind: "withdrawal", amount: 4, amountType: "percent", startAge: "@k1" }] }],
    });
    expect(plan.accounts[0].schedules[0]).toMatchObject({ startAge: "@k1", amountType: "percent" });
  });
});

describe("import / export", () => {
  it("round-trips through the export document", () => {
    const plan = defaultPlan();
    const text = serializePlan(plan, new Date("2026-09-04T12:00:00Z"));
    const doc = JSON.parse(text);
    expect(doc).toMatchObject({ format: "nestimate-plan", version: 1, exportedAt: "2026-09-04T12:00:00.000Z" });
    expect(parsePlanFile(text)).toEqual(plan);
  });

  it("accepts a bare plan object too", () => {
    const plan = defaultPlan();
    expect(parsePlanFile(JSON.stringify(plan))).toEqual(plan);
  });

  it("rejects bad input with readable messages", () => {
    expect(() => parsePlanFile("{not json")).toThrow(/valid JSON/);
    expect(() => parsePlanFile(JSON.stringify({ format: "nestimate-plan", version: 99, plan: {} }))).toThrow(/newer version/);
    expect(() => parsePlanFile(JSON.stringify({ format: "nestimate-plan", version: 1, plan: {} }))).toThrow(/accounts/);
  });

  it("names export files by date", () => {
    expect(exportFileName(new Date("2026-09-04T23:59:00Z"))).toBe("nestimate-plan-2026-09-04.json");
  });
});

describe("localStorage persistence", () => {
  const store = new Map();
  beforeEach(() => {
    store.clear();
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
  });

  it("returns null when nothing is saved", () => {
    expect(loadPlan()).toBeNull();
    expect(loadTheme()).toBeNull();
  });

  it("saves and reloads a plan", () => {
    const plan = defaultPlan();
    expect(savePlan(plan)).toBe(true);
    expect(store.has(PLAN_KEY)).toBe(true);
    expect(loadPlan()).toEqual(plan);
    clearPlan();
    expect(loadPlan()).toBeNull();
  });

  it("ignores corrupt saved data", () => {
    store.set(PLAN_KEY, "{oops");
    expect(loadPlan()).toBeNull();
    store.set(PLAN_KEY, JSON.stringify({ nope: true }));
    expect(loadPlan()).toBeNull();
  });

  it("saves and reloads the theme", () => {
    saveTheme("dark");
    expect(loadTheme()).toBe("dark");
    saveTheme("purple");
    expect(loadTheme()).toBeNull();
  });

  it("reports false when storage is unavailable", () => {
    globalThis.window = { get localStorage() { throw new Error("blocked"); } };
    expect(savePlan(defaultPlan())).toBe(false);
    expect(loadPlan()).toBeNull();
  });
});
