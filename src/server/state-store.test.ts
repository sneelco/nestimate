import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeEnvelope, deleteState, getState, putState, replaceState, stateKey } from "./state-store";
import { APP_ID } from "../shared/app";
import { MAX_STATE_BYTES } from "../shared/api-types";
import { defaultState, type AppState } from "../shared/state";

const plan = (name: string): AppState => {
  const s = defaultState();
  s.plan.accounts[0]!.name = name;
  return s;
};

describe("state-store", () => {
  it("returns null before anything is written", async () => {
    expect(await getState(env.STATE, "u1")).toBeNull();
  });

  it("first write must use baseRev 0 and yields rev 1", async () => {
    const r = await putState(env.STATE, "u1", 0, plan("a"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envelope).toMatchObject({ appId: APP_ID, rev: 1 });
    expect(await getState(env.STATE, "u1")).toEqual(r.envelope);
  });

  it("rejects a stale baseRev with the current envelope", async () => {
    await putState(env.STATE, "u2", 0, plan("a"));
    await putState(env.STATE, "u2", 1, plan("b"));
    const stale = await putState(env.STATE, "u2", 1, plan("c"));
    expect(stale.ok).toBe(false);
    if (stale.ok || stale.reason !== "conflict") throw new Error("expected conflict");
    expect(stale.current.rev).toBe(2);
    expect(stale.current.data.plan.accounts[0]?.name).toBe("b");
  });

  it("replaceState bumps rev without a base check", async () => {
    await putState(env.STATE, "u3", 0, defaultState());
    const r = await replaceState(env.STATE, "u3", plan("x"));
    expect(r.ok && r.envelope.rev).toBe(2);
  });

  it("enforces the soft size cap", async () => {
    const big = plan("x".repeat(MAX_STATE_BYTES + 10));
    const r = await putState(env.STATE, "u4", 0, big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });

  it("delete clears and resets rev to 0", async () => {
    await putState(env.STATE, "u5", 0, defaultState());
    await deleteState(env.STATE, "u5");
    expect(await getState(env.STATE, "u5")).toBeNull();
    const r = await putState(env.STATE, "u5", 0, defaultState());
    expect(r.ok && r.envelope.rev).toBe(1);
  });

  it("treats corrupt or foreign envelopes as absent", async () => {
    await env.STATE.put(stateKey("u6"), "{not json");
    expect(await getState(env.STATE, "u6")).toBeNull();
    expect(decodeEnvelope(JSON.stringify({ appId: "other-app", schemaVersion: 1, rev: 1, updatedAt: "", data: {} }))).toBeNull();
  });
});
