import { describe, it, expect } from "vitest";
import { defaultState, migrate, parseState, SCHEMA_VERSION, stateSchema } from "./state";
import { defaultPlan } from "./nestimate/plan.js";

describe("nestimate state schema", () => {
  it("defaultState satisfies the schema", () => {
    const s = defaultState();
    expect(stateSchema.parse(s)).toEqual(s);
  });

  it("fills a missing plan with the sample plan", () => {
    const s = parseState({});
    expect(s.plan.accounts.length).toBe(defaultPlan().accounts.length);
  });

  it("normalizes lenient input like the old app did", () => {
    const s = parseState({ plan: { accounts: [{ name: "401(k)", type: "balance", balance: "1e5", growth: null }] } });
    expect(s.plan.accounts[0]).toMatchObject({ taxType: "deferred", balance: 100000, growth: 0 });
    expect(s.plan.endAge).toBe(95);
    expect(s.plan.tax).toEqual({ incomeRate: 22, gainsRate: 15, rmd: true });
  });

  it("rejects a hopeless plan", () => {
    expect(() => parseState({ plan: {} })).toThrow(/accounts/);
    expect(() => parseState({ plan: "nope" })).toThrow();
  });

  it("migrate is identity for the current version and rejects newer", () => {
    const s = defaultState();
    expect(migrate(s, SCHEMA_VERSION)).toBe(s);
    expect(() => migrate({}, SCHEMA_VERSION + 1)).toThrow(/newer version/);
  });
});
