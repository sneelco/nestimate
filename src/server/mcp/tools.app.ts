/**
 * ★ APP BOUNDARY ★ — Nestimate MCP tools.
 *
 * `get_state` / `replace_state` / `patch_state` (core) already expose the plan
 * document itself. These add the thing an assistant actually wants: run the
 * projection engine over the plan and get the numbers back.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getState } from "../state-store";
import { jsonResult, errorResult, type ToolContext } from "./tools.core";
import { defaultState, type Plan } from "../../shared/state";
import { simulate } from "../../shared/nestimate/simulate.js";
import { ageFromBirthday, buildKeyMap, collectMilestones, rmdStartAge } from "../../shared/nestimate/plan.js";
import { num } from "../../shared/nestimate/format.js";

export type AppToolRegistrar = (server: McpServer, ctx: ToolContext) => void;

// simulate.js is untyped JavaScript shared with the client; describe its result here.
type Row = { age: number; __total: number } & Record<string, number | undefined>;
interface Sim {
  worthRows: Row[];
  incomeRows: Row[];
  depletionAge: number | null;
  shortfallAge: number | null;
  totalTaxes: number;
}
const runSimulation = simulate as unknown as (args: Record<string, unknown>) => Sim;

async function loadPlan(ctx: ToolContext): Promise<Plan> {
  const env = await getState(ctx.kv, ctx.userId);
  return env?.data.plan ?? defaultState().plan;
}

/** Same projection the UI runs; returns null when the plan cannot be simulated. */
export function project(plan: Plan, now = Date.now()) {
  const currentAge = ageFromBirthday(plan.birthday, now);
  const endAge = num(plan.endAge, 95);
  if (currentAge === null || currentAge <= 0 || currentAge >= endAge) return null;
  const keyMap = buildKeyMap(plan.keyAges);
  const sim = runSimulation({ accounts: plan.accounts, keyMap, startAge: currentAge, endAge, spending: plan.spending, tax: plan.tax, drawdown: plan.drawdown, birthday: plan.birthday });
  if (sim.worthRows.length === 0) return null;
  let peak = sim.worthRows[0]!;
  for (const r of sim.worthRows) if (r.__total > peak.__total) peak = r;
  const last = sim.worthRows[sim.worthRows.length - 1]!;
  const nameOf = (id: string) => plan.accounts.find((a) => a.id === id)?.name ?? id;
  const years = sim.incomeRows.map((row) => {
    const worth = sim.worthRows.find((w) => w.age === row.age);
    const bySource: Record<string, number> = {};
    for (const a of plan.accounts) {
      const v = row[a.id];
      if (typeof v === "number" && v > 0) bySource[nameOf(a.id)] = Math.round(v);
    }
    return {
      age: row.age,
      netWorth: worth ? Math.round(worth.__total) : null,
      afterTaxIncome: Math.round(row.__net ?? 0),
      taxes: Math.round(row.__taxes ?? 0),
      spending: Math.round(row.__spending ?? 0),
      shortfall: Math.round(row.__shortfall ?? 0),
      incomeBySource: bySource,
    };
  });
  return {
    currentAge: Number(currentAge.toFixed(1)),
    endAge,
    peakNetWorth: { amount: Math.round(peak.__total), age: Math.round(peak.age) },
    netWorthAtEnd: Math.round(last.__total),
    depletionAge: sim.depletionAge,
    shortfallAge: sim.shortfallAge,
    lifetimeTaxes: Math.round(sim.totalTaxes),
    rmdStartAge: rmdStartAge(plan.birthday),
    years,
  };
}

const summarizePlan: AppToolRegistrar = (server, ctx) => {
  server.registerTool(
    "summarize_plan",
    {
      title: "Summarize plan",
      description: "Human-readable overview of the retirement plan: birthday/age, key ages, accounts (balances, growth, tax treatment, schedules), income streams, spending items, tax settings, and the milestones the charts mark.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const plan = await loadPlan(ctx);
      const currentAge = ageFromBirthday(plan.birthday);
      return jsonResult({
        birthday: plan.birthday,
        currentAge: currentAge === null ? null : Number(currentAge.toFixed(1)),
        projectToAge: plan.endAge,
        keyAges: plan.keyAges,
        accounts: plan.accounts.map((a) =>
          a.type === "balance"
            ? { id: a.id, name: a.name, type: a.type, balance: a.balance, growthPct: a.growth, taxType: a.taxType, drawdown: a.drawdown, drawdownFrom: a.drawdownFrom, schedules: a.schedules }
            : { id: a.id, name: a.name, type: a.type, colaPct: a.cola, taxablePct: a.taxablePct, schedules: a.schedules },
        ),
        spending: plan.spending,
        tax: plan.tax,
        drawdown: plan.drawdown,
        milestones: collectMilestones(plan.accounts, plan.keyAges, plan.spending),
        note: "Ages in schedules: \"\" = now/never, a number = that age, \"@<keyAgeId>\" = reference to a key age.",
      });
    },
  );
};

const runProjection: AppToolRegistrar = (server, ctx) => {
  server.registerTool(
    "run_projection",
    {
      title: "Run projection",
      description: "Run the month-by-month projection over the saved plan (or over a plan you pass in, without saving it). Returns peak and final net worth, depletion/shortfall ages, lifetime taxes, and per-year rows of net worth, after-tax income by source, taxes, spending and shortfall. Use `plan` to answer what-if questions without changing the user's data.",
      inputSchema: {
        plan: z.record(z.string(), z.unknown()).optional().describe("Optional plan document to project instead of the saved one (same shape as state.plan)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ plan: override }) => {
      let plan: Plan;
      if (override) {
        const parsed = (await import("../../shared/state")).stateSchema.safeParse({ plan: override });
        if (!parsed.success) return errorResult(`Plan is invalid:\n${parsed.error.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
        plan = parsed.data.plan;
      } else {
        plan = await loadPlan(ctx);
      }
      const result = project(plan);
      if (!result) return errorResult("The plan cannot be projected: check that the birthday is valid and the end age is in the future.");
      return jsonResult(result);
    },
  );
};

export const appTools: AppToolRegistrar[] = [summarizePlan, runProjection];
