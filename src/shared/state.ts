/**
 * ★ APP BOUNDARY ★ — Nestimate's state blob.
 *
 * The state is `{ plan }`, where `plan` is the retirement plan document the
 * original browser-only Nestimate kept under `nestimate.plan.v1`. Validation
 * runs the existing lenient `normalizePlan` (junk fields fall back to safe
 * defaults, only a hopeless document is rejected) and then checks the result
 * against a strict Zod description of the normalized shape, so the API, the
 * MCP tools, and imports all accept anything the old app accepted.
 */
import { z } from "zod";
import { normalizePlan, loadPlan } from "./nestimate/storage.js";
import { ACCOUNT_TYPES, AMOUNT_TYPES, FREQS, SCHEDULE_KINDS, TAX_TYPES, defaultPlan } from "./nestimate/plan.js";

export const SCHEMA_VERSION = 1;

/** "" (open / now / never), a number, or "@<keyAgeId>". */
const ageRef = z.union([z.literal(""), z.number(), z.string().regex(/^@.+/)]);
const numOrBlank = z.union([z.number(), z.literal("")]);
const freq = z.enum(FREQS.map((f) => f.id) as [string, ...string[]]);

const scheduleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(SCHEDULE_KINDS as [string, ...string[]]),
  amount: numOrBlank,
  amountType: z.enum(AMOUNT_TYPES as [string, ...string[]]),
  freq,
  startAge: ageRef,
  endAge: ageRef,
});

const balanceAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.literal("balance"),
  taxType: z.enum(TAX_TYPES.map((t) => t.id) as [string, ...string[]]),
  drawdown: z.boolean(),
  drawdownFrom: ageRef,
  balance: z.number(),
  growth: z.number(),
  schedules: z.array(scheduleSchema),
});

const incomeAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.literal("income"),
  cola: z.number(),
  taxablePct: z.number().min(0).max(100),
  schedules: z.array(scheduleSchema),
});

export const planSchema = z.object({
  birthday: z.string(),
  endAge: numOrBlank,
  keyAges: z.array(z.object({ id: z.string().min(1), name: z.string(), age: numOrBlank })),
  accounts: z.array(z.discriminatedUnion("type", [balanceAccountSchema, incomeAccountSchema])),
  spending: z.array(
    z.object({ id: z.string().min(1), name: z.string(), amount: numOrBlank, freq, increase: z.number(), startAge: ageRef, endAge: ageRef }),
  ),
  tax: z.object({ incomeRate: z.number(), gainsRate: z.number(), rmd: z.boolean() }),
  drawdown: z.object({ enabled: z.boolean() }),
});

/** Lenient input (anything normalizePlan accepts) → strict normalized plan. */
const normalizedPlan = z
  .unknown()
  .transform((raw, ctx) => {
    try {
      return normalizePlan(raw) as unknown;
    } catch (err) {
      ctx.addIssue({ code: "custom", message: err instanceof Error ? err.message : "Invalid plan." });
      return z.NEVER;
    }
  })
  .pipe(planSchema);

export const stateSchema = z.object({
  plan: normalizedPlan.default(() => defaultPlan() as Plan),
});

export type Plan = z.infer<typeof planSchema>;
export type Account = Plan["accounts"][number];
export type AppState = z.infer<typeof stateSchema>;

export { ACCOUNT_TYPES, defaultPlan };

export function defaultState(): AppState {
  return { plan: defaultPlan() as Plan };
}

/** Upgrade a blob written under an older SCHEMA_VERSION. */
export function migrate(data: unknown, fromVersion: number): unknown {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(`State was written by a newer version (v${fromVersion}, this build understands v${SCHEMA_VERSION}).`);
  }
  let current = data;
  if (fromVersion < 1) current = defaultState();
  return current;
}

export function parseState(data: unknown, fromVersion: number = SCHEMA_VERSION): AppState {
  return stateSchema.parse(migrate(data, fromVersion));
}

/**
 * First run on this browser: adopt a plan saved by the pre-Outpost Nestimate
 * (localStorage key `nestimate.plan.v1`) so nobody loses their plan.
 */
export function bootstrapState(): AppState | null {
  const legacy = loadPlan();
  return legacy ? { plan: legacy as Plan } : null;
}

// No mergeState: a plan is one document edited by one person, so whole-blob
// last-writer-wins (with the losing copy kept as a backup) is the right call.
