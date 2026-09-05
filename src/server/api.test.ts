import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { defaultState } from "../shared/state";

// Must match BETTER_AUTH_URL in .dev.vars (Better Auth rejects other origins).
const BASE = "http://localhost:5173";

describe("api", () => {
  it("GET /api/health returns ok + version", async () => {
    const res = await SELF.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; version: string; app: string }>();
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
  });

  it("GET /api/state without a session is 401", async () => {
    const res = await SELF.fetch(`${BASE}/api/state`);
    expect(res.status).toBe(401);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("unauthorized");
  });

  it("/mcp without a bearer key is 401 with WWW-Authenticate", async () => {
    const res = await SELF.fetch(`${BASE}/mcp`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/Bearer/);
  });

  it("/mcp ignores cookies", async () => {
    const res = await SELF.fetch(`${BASE}/mcp`, { method: "POST", body: "{}", headers: { cookie: "better-auth.session_token=whatever" } });
    expect(res.status).toBe(401);
  });

  it("sign-up + session + state round trip", async () => {
    const email = `user-${crypto.randomUUID()}@example.com`;
    const signUp = await SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `${BASE}` },
      body: JSON.stringify({ name: "Test", email, password: "correct horse battery" }),
    });
    expect(signUp.status).toBe(200);
    const cookie = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    expect(cookie).toMatch(/session_token/);

    const empty = await SELF.fetch(`${BASE}/api/state`, { headers: { cookie } });
    expect(empty.status).toBe(204);

    const put = await SELF.fetch(`${BASE}/api/state`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ baseRev: 0, data: defaultState() }),
    });
    expect(put.status).toBe(200);
    expect((await put.json<{ rev: number }>()).rev).toBe(1);

    const stale = await SELF.fetch(`${BASE}/api/state`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ baseRev: 0, data: defaultState() }),
    });
    expect(stale.status).toBe(409);
    const conflict = await stale.json<{ error: { code: string; current: { rev: number } } }>();
    expect(conflict.error.code).toBe("conflict");
    expect(conflict.error.current.rev).toBe(1);

    const invalid = await SELF.fetch(`${BASE}/api/state`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ baseRev: 1, data: { plan: {} } }),
    });
    expect(invalid.status).toBe(422);

    // API key → MCP round trip.
    const created = await SELF.fetch(`${BASE}/api/auth/api-key/create`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: `${BASE}` },
      body: JSON.stringify({ name: "test" }),
    });
    expect(created.status).toBe(200);
    const { key } = await created.json<{ key: string }>();
    const mcp = await SELF.fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_state", arguments: {} } }),
    });
    expect(mcp.status).toBe(200);
    const rpc = await mcp.json<{ result: { content: { type: string; text: string }[] } }>();
    const envelope = JSON.parse(rpc.result.content[0]!.text) as { rev: number; data: { plan: { accounts: unknown[] } } };
    expect(envelope.rev).toBe(1);
    expect(envelope.data.plan.accounts.length).toBe(defaultState().plan.accounts.length);

    // App tool: the projection runs over the saved plan.
    const proj = await SELF.fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "run_projection", arguments: {} } }),
    });
    expect(proj.status).toBe(200);
    const projRpc = await proj.json<{ result: { content: { text: string }[]; isError?: boolean } }>();
    expect(projRpc.result.isError).toBeFalsy();
    const result = JSON.parse(projRpc.result.content[0]!.text) as { peakNetWorth: { amount: number }; years: unknown[] };
    expect(result.peakNetWorth.amount).toBeGreaterThan(0);
    expect(result.years.length).toBeGreaterThan(10);
  });
});
