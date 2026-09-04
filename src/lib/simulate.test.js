import { describe, it, expect } from "vitest";
import { simulate as simulateRaw } from "./simulate.js";
import { buildKeyMap, resolveAge, collectMilestones, rmdStartAge, rmdDivisor, guessTaxType } from "./plan.js";

const balance = (over = {}) => ({
  id: "acct", name: "Acct", type: "balance", taxType: "roth", drawdown: true, balance: 100000, growth: 0, schedules: [], ...over,
});
// Default to no taxes / no RMDs so the basic tests read plainly; tax tests opt in.
const simulate = (accounts, keyMap, startAge, endAge, extra = {}) =>
  simulateRaw({ accounts, keyMap, startAge, endAge, tax: { incomeRate: 0, gainsRate: 0, rmd: false }, ...extra });

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

describe("spending and drawdown", () => {
  const living = { id: "sp", name: "Living", amount: 1000, freq: "monthly", increase: 0, startAge: "", endAge: "" };

  it("draws the shortfall from accounts in list order", () => {
    const first = balance({ id: "first", balance: 6000 });
    const second = balance({ id: "second", balance: 100000 });
    const { incomeRows, worthRows } = simulate([first, second], {}, 40, 42, { spending: [living] });
    // Year 40 (11 months): first account covers 6 months, second covers 5.
    expect(incomeRows[0]).toMatchObject({ age: 40, first: 6000, second: 5000, __spending: 11000, __shortfall: 0 });
    expect(worthRows[worthRows.length - 1].first).toBe(0);
  });

  it("uses income streams before touching accounts", () => {
    const pension = { id: "pen", name: "Pension", type: "income", cola: 0, taxablePct: 0,
      schedules: [{ id: "p", kind: "payment", amount: 800, amountType: "fixed", freq: "monthly", startAge: "", endAge: "" }] };
    const acct = balance({ balance: 100000 });
    const { incomeRows } = simulate([pension, acct], {}, 40, 41, { spending: [living] });
    expect(incomeRows[0]).toMatchObject({ pen: 8800, acct: 2200, __shortfall: 0 });
  });

  it("skips accounts with drawdown turned off and records uncovered spending", () => {
    const locked = balance({ id: "locked", balance: 100000, drawdown: false });
    const small = balance({ id: "small", balance: 3000 });
    const { incomeRows, shortfallAge } = simulate([locked, small], {}, 40, 41, { spending: [living] });
    expect(incomeRows[0].locked).toBe(0);
    expect(incomeRows[0].small).toBe(3000);
    expect(incomeRows[0].__shortfall).toBe(8000);
    expect(shortfallAge).toBeCloseTo(40.3, 1);
  });

  it("does nothing when drawdown is disabled", () => {
    const acct = balance({ balance: 100000 });
    const { incomeRows, shortfallAge } = simulate([acct], {}, 40, 41, { spending: [living], drawdown: { enabled: false } });
    expect(incomeRows[0].acct).toBe(0);
    expect(incomeRows[0].__shortfall).toBe(11000);
    expect(shortfallAge).not.toBeNull();
  });

  it("escalates spending by its annual increase", () => {
    const acct = balance({ balance: 1e6 });
    const { incomeRows } = simulate([acct], {}, 40, 43, { spending: [{ ...living, increase: 10 }] });
    expect(incomeRows[2].__spending).toBeGreaterThan(incomeRows[1].__spending);
  });
});

describe("taxes", () => {
  const living = { id: "sp", name: "Living", amount: 1000, freq: "monthly", increase: 0, startAge: "", endAge: "" };
  const tax = { incomeRate: 20, gainsRate: 10, rmd: false };

  it("grosses up deferred withdrawals so the net covers spending", () => {
    const ira = balance({ id: "ira", taxType: "deferred", balance: 1e6 });
    const { incomeRows } = simulate([ira], {}, 40, 41, { spending: [living], tax });
    // net 11,000 requires gross 13,750 at 20%
    expect(incomeRows[0]).toMatchObject({ ira: 11000, __taxes: 2750, __gross: 13750, __shortfall: 0 });
  });

  it("applies the gains rate to taxable accounts and nothing to Roth", () => {
    const brokerage = balance({ id: "brk", taxType: "taxable", balance: 1e6,
      schedules: [{ id: "w", kind: "withdrawal", amount: 1000, amountType: "fixed", freq: "monthly", startAge: "", endAge: "" }] });
    const roth = balance({ id: "roth", taxType: "roth", balance: 1e6,
      schedules: [{ id: "w2", kind: "withdrawal", amount: 1000, amountType: "fixed", freq: "monthly", startAge: "", endAge: "" }] });
    const { incomeRows } = simulate([brokerage, roth], {}, 40, 41, { tax });
    expect(incomeRows[0]).toMatchObject({ brk: 9900, roth: 11000, __taxes: 1100 });
  });

  it("taxes only the taxable portion of income streams", () => {
    const ss = { id: "ss", name: "SS", type: "income", cola: 0, taxablePct: 50,
      schedules: [{ id: "p", kind: "payment", amount: 1000, amountType: "fixed", freq: "monthly", startAge: "", endAge: "" }] };
    const { incomeRows, totalTaxes } = simulate([ss], {}, 40, 41, { tax });
    expect(incomeRows[0]).toMatchObject({ ss: 9900, __taxes: 1100 });
    expect(totalTaxes).toBe(1200); // 11 months in the 40 bucket + 1 in the 41 bucket
  });

  it("forces required minimum distributions from tax-deferred accounts", () => {
    const ira = balance({ id: "ira", taxType: "deferred", balance: 265000 });
    const { incomeRows, rmdAge } = simulate([ira], {}, 72.5, 74, { tax: { ...tax, rmd: true }, birthday: "1953-01-01" });
    expect(rmdAge).toBe(73);
    // At 73 the divisor is 26.5, so the full-year RMD on $265k is $10k gross ($8k net at 20%).
    const at73 = incomeRows.find((r) => r.age === 73);
    expect(at73.__gross).toBe(10000);
    expect(at73.ira).toBe(8000);
    expect(incomeRows.find((r) => r.age === 72).__gross).toBe(0);
  });

  it("does not force distributions from Roth or taxable accounts", () => {
    const roth = balance({ id: "roth", taxType: "roth", balance: 1e6 });
    const brk = balance({ id: "brk", taxType: "taxable", balance: 1e6 });
    const { incomeRows } = simulate([roth, brk], {}, 75, 77, { tax: { ...tax, rmd: true }, birthday: "1950-01-01" });
    expect(incomeRows.every((r) => r.__gross === 0)).toBe(true);
  });
});

describe("RMD helpers", () => {
  it("picks the SECURE 2.0 start age from birth year", () => {
    expect(rmdStartAge("1959-12-31")).toBe(73);
    expect(rmdStartAge("1960-01-01")).toBe(75);
    expect(rmdStartAge("garbage")).toBe(73);
  });
  it("looks up the uniform lifetime table with clamping", () => {
    expect(rmdDivisor(73)).toBe(26.5);
    expect(rmdDivisor(95.7)).toBe(8.9);
    expect(rmdDivisor(60)).toBe(27.4);
    expect(rmdDivisor(130)).toBe(2.0);
  });
  it("guesses a tax type from an account name", () => {
    expect(guessTaxType("Roth IRA")).toBe("roth");
    expect(guessTaxType("401(k)")).toBe("deferred");
    expect(guessTaxType("Traditional IRA")).toBe("deferred");
    expect(guessTaxType("Brokerage")).toBe("taxable");
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
    const spending = [{ id: "sp", name: "Travel", amount: 1, freq: "monthly", increase: 0, startAge: "@r", endAge: 75 }];
    const m = collectMilestones([acct], keyAges, spending);
    expect(m.map((x) => x.age)).toEqual([30, 60, 60, 60, 75]);
    expect(m[1].label).toContain("(Retire)");
    expect(m[4].label).toBe("Travel: spending ends");
  });
});
