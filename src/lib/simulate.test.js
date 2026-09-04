import { describe, it, expect } from "vitest";
import { simulate } from "./simulate.js";
import { buildKeyMap, resolveAge, collectMilestones } from "./plan.js";

const balance = (over = {}) => ({
  id: "acct", name: "Acct", type: "balance", balance: 100000, growth: 0, schedules: [], ...over,
});

describe("resolveAge", () => {
  const keyMap = buildKeyMap([{ id: "r", name: "Retire", age: 60 }, { id: "blank", name: "", age: "" }]);
  it("treats blank as open", () => expect(resolveAge("", keyMap)).toBeNull());
  it("resolves key-age references", () => expect(resolveAge("@r", keyMap)).toBe(60));
  it("ignores references to key ages without a value", () => expect(resolveAge("@blank", keyMap)).toBeNull());
  it("ignores references to missing key ages", () => expect(resolveAge("@nope", keyMap)).toBeNull());
  it("parses explicit ages", () => expect(resolveAge("57.5", keyMap)).toBe(57.5));
});

describe("simulate", () => {
  it("compounds growth with no schedules", () => {
    const { worthRows, depletionAge } = simulate([balance({ growth: 7 })], {}, 40, 50);
    const last = worthRows[worthRows.length - 1];
    expect(last.age).toBe(50);
    expect(last.__total).toBeCloseTo(100000 * 1.07 ** 10, -3);
    expect(depletionAge).toBeNull();
  });

  it("adds contributions between start and end ages", () => {
    const acct = balance({
      balance: 0,
      schedules: [{ id: "c", kind: "contribution", amount: 100, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@r" }],
    });
    const { worthRows } = simulate([acct], buildKeyMap([{ id: "r", age: 45 }]), 40, 50);
    // End age is exclusive: the month landing exactly on 45 is not contributed,
    // so 59 months * $100, then flat.
    expect(worthRows.find((r) => r.age === 45).__total).toBe(5900);
    expect(worthRows[worthRows.length - 1].__total).toBe(5900);
  });

  it("records income and depletion for withdrawals that outlast the balance", () => {
    const acct = balance({
      balance: 12000,
      schedules: [{ id: "w", kind: "withdrawal", amount: 1000, amountType: "fixed", freq: "monthly", startAge: "", endAge: "" }],
    });
    const { incomeRows, depletionAge, worthRows } = simulate([acct], {}, 40, 45);
    expect(depletionAge).toBe(41);
    // Income buckets by whole age; the twelfth month lands on 41.0 and counts there.
    expect(incomeRows[0]).toMatchObject({ age: 40, acct: 11000 });
    expect(incomeRows[1]).toMatchObject({ age: 41, acct: 1000 });
    expect(worthRows[worthRows.length - 1].__total).toBe(0);
  });

  it("applies COLA to income streams", () => {
    const income = {
      id: "ss", name: "SS", type: "income", cola: 10,
      schedules: [{ id: "p", kind: "payment", amount: 1000, amountType: "fixed", freq: "yearly", startAge: "", endAge: "" }],
    };
    const { incomeRows, worthRows } = simulate([income], {}, 40, 42);
    expect(worthRows.every((r) => r.__total === 0)).toBe(true);
    expect(incomeRows[1].ss).toBeGreaterThan(incomeRows[0].ss);
  });
});

describe("collectMilestones", () => {
  it("lists resolved schedule boundaries sorted by age", () => {
    const keyAges = [{ id: "r", name: "Retire", age: 60 }];
    const acct = balance({
      schedules: [
        { id: "a", kind: "withdrawal", amount: 1, amountType: "fixed", freq: "monthly", startAge: "@r", endAge: "" },
        { id: "b", kind: "contribution", amount: 1, amountType: "fixed", freq: "monthly", startAge: 30, endAge: "@r" },
      ],
    });
    const m = collectMilestones([acct], keyAges);
    expect(m.map((x) => x.age)).toEqual([30, 60, 60]);
    expect(m[1].label).toContain("(Retire)");
  });
});
