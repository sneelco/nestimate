import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { THEMES, ThemeCtx, systemTheme } from "./theme.js";
import { fmtAxis, num } from "./lib/format.js";
import { ageFromBirthday, buildKeyMap, collectMilestones, defaultPlan, newAccount } from "./lib/plan.js";
import { simulate } from "./lib/simulate.js";
import { loadPlan, savePlan, loadTheme, saveTheme } from "./lib/storage.js";
import { AddBtn, Card, EggMark, Field, NumInput } from "./components/ui.jsx";
import KeyAgesCard from "./components/KeyAgesCard.jsx";
import AccountCard from "./components/AccountCard.jsx";
import PlanDataCard from "./components/PlanDataCard.jsx";
import { ChartCard, ChartTip, Stat } from "./components/charts.jsx";

export default function Nestimate() {
  const [mode, setMode] = useState(() => loadTheme() || systemTheme());
  const T = THEMES[mode];

  // The whole editable plan lives in one object so it can be persisted,
  // exported, and imported as a unit.
  const [plan, setPlan] = useState(() => loadPlan() || defaultPlan());
  const [persisted, setPersisted] = useState(true);
  const { birthday, endAge, keyAges, accounts } = plan;
  const patch = (p) => setPlan((prev) => ({ ...prev, ...p }));
  const setAccounts = (accounts) => patch({ accounts });
  const setKeyAges = (keyAges) => patch({ keyAges });

  useEffect(() => { setPersisted(savePlan(plan)); }, [plan]);
  useEffect(() => { saveTheme(mode); }, [mode]);

  const currentAge = ageFromBirthday(birthday);
  const keyMap = useMemo(() => buildKeyMap(keyAges), [keyAges]);
  const colorOf = {};
  accounts.forEach((a, i) => { colorOf[a.id] = T.palette[i % T.palette.length]; });

  const sim = useMemo(() => {
    if (currentAge === null || currentAge <= 0 || currentAge >= num(endAge, 95)) return null;
    return simulate(accounts, keyMap, currentAge, num(endAge, 95));
  }, [accounts, keyMap, birthday, endAge]); // eslint-disable-line

  const milestones = useMemo(() => collectMilestones(accounts, keyAges), [accounts, keyAges]);
  const balanceAccounts = accounts.filter((a) => a.type === "balance");

  // Key-age lines get named labels; schedule milestones that coincide with a key age are not double-drawn.
  const keyLines = keyAges.filter((k) => k.age !== "" && !isNaN(parseFloat(k.age)))
    .map((k) => ({ age: num(k.age), name: k.name || "Key age" }));
  const keyAgeSet = new Set(keyLines.map((k) => k.age));
  const milestoneLines = [...new Set(milestones.map((m) => m.age))].filter((a) => !keyAgeSet.has(a));

  const peak = useMemo(() => {
    if (!sim) return null;
    let best = null;
    sim.worthRows.forEach((r) => { if (!best || r.__total > best.__total) best = r; });
    return best;
  }, [sim]);

  const inputStyle = {
    border: `1px solid ${T.line}`, borderRadius: 6, padding: "7px 9px",
    fontSize: 14, color: T.ink, background: T.card, width: "100%",
    outline: "none", boxSizing: "border-box", colorScheme: mode,
  };

  const refLines = (withLabels) => (
    <>
      {keyLines.map((k) => (
        <ReferenceLine key={"k" + k.age + k.name} x={k.age} stroke={T.accent}
          strokeDasharray="5 3" strokeOpacity={0.7}
          label={withLabels ? { value: k.name, position: "top", fontSize: 10, fill: T.accent } : undefined} />
      ))}
      {milestoneLines.map((age) => (
        <ReferenceLine key={"m" + age} x={age} stroke={T.mute} strokeDasharray="3 3" strokeOpacity={0.45}
          label={withLabels ? { value: age, position: "top", fontSize: 10, fill: T.mute } : undefined} />
      ))}
    </>
  );

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{
        minHeight: "100vh", background: T.bg, color: T.ink,
        fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
        padding: "16px 12px 48px", transition: "background .25s, color .25s",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px 2px" }}>
            <EggMark />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Nestimate
              </h1>
              <p style={{ margin: 0, fontSize: 12.5, color: T.mute }}>Size up the nest egg.</p>
            </div>
            <button type="button" onClick={() => setMode(mode === "light" ? "dark" : "light")}
              aria-label="Toggle dark mode"
              style={{
                border: `1px solid ${T.line}`, background: T.card, color: T.ink,
                borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer",
              }}>
              {mode === "light" ? "☾ Dark" : "☀ Light"}
            </button>
          </header>

          {/* setup */}
          <Card style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Birthday" w="46%">
              <input type="date" value={birthday} onChange={(e) => patch({ birthday: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Project to age" w="24%">
              <NumInput value={endAge} onChange={(v) => patch({ endAge: v })} />
            </Field>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: 13, color: T.mute, paddingBottom: 8 }}>
              {currentAge !== null
                ? <span>You're <b style={{ color: T.ink }}>{currentAge.toFixed(1)}</b> today</span>
                : <span>Enter a valid birthday</span>}
            </div>
          </Card>

          {/* key ages */}
          <KeyAgesCard keyAges={keyAges} setKeyAges={setKeyAges} />

          {/* summary strip */}
          {sim && peak && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat label="Peak net worth" value={fmtAxis(peak.__total)} sub={`at age ${Math.round(peak.age)}`} />
              <Stat label={`Net worth at ${endAge}`} value={fmtAxis(sim.worthRows[sim.worthRows.length - 1].__total)} />
              {sim.depletionAge !== null && (
                <Stat label="Balances depleted" value={`age ${sim.depletionAge}`} warn />
              )}
            </div>
          )}

          {/* net worth chart */}
          {sim && (
            <ChartCard title="Net worth" note="Investment balances, stacked. Teal lines are key ages; gray lines are other schedule milestones.">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={sim.worthRows} syncId="nestimate" syncMethod="value"
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]}
                    tickCount={8} tick={{ fontSize: 11, fill: T.mute }} tickFormatter={(v) => Math.round(v)} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: T.mute }} width={46} />
                  <Tooltip content={<ChartTip accounts={accounts} totalLabel="Total" />} />
                  {refLines(true)}
                  {balanceAccounts.map((a) => (
                    <Area key={a.id} dataKey={a.id} stackId="1" type="monotone"
                      stroke={colorOf[a.id]} fill={colorOf[a.id]} fillOpacity={0.5} strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* income chart */}
          {sim && sim.incomeRows.length > 0 && (
            <ChartCard title="Annual income" note="Withdrawals plus income-stream payments, by source.">
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={sim.incomeRows} syncId="nestimate" syncMethod="value"
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]}
                    tickCount={8} tick={{ fontSize: 11, fill: T.mute }} tickFormatter={(v) => Math.round(v)} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: T.mute }} width={46} />
                  <Tooltip content={<ChartTip accounts={accounts} totalLabel="Total / yr" />} />
                  {refLines(false)}
                  {accounts.map((a) => (
                    <Area key={a.id} dataKey={a.id} stackId="1" type="step"
                      stroke={colorOf[a.id]} fill={colorOf[a.id]} fillOpacity={0.5} strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* legend + milestones */}
          <Card>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: (milestones.length || keyLines.length) ? 10 : 0 }}>
              {accounts.map((a) => (
                <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: colorOf[a.id] }} />
                  {a.name}
                </span>
              ))}
            </div>
            {(keyLines.length > 0 || milestones.length > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                {keyLines.map((k, i) => (
                  <div key={"k" + i} style={{ fontSize: 12, display: "flex", gap: 8 }}>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: T.accent, width: 34 }}>{k.age}</span>
                    <span style={{ color: T.accent, fontWeight: 600 }}>{k.name}</span>
                  </div>
                ))}
                {milestones.map((m, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.mute, display: "flex", gap: 8 }}>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: T.ink, width: 34 }}>{m.age}</span>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* accounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accounts</h2>
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} color={colorOf[a.id]} keyAges={keyAges}
                onChange={(next) => setAccounts(accounts.map((x) => (x.id === a.id ? next : x)))}
                onDelete={() => setAccounts(accounts.filter((x) => x.id !== a.id))} />
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <AddBtn onClick={() => setAccounts([...accounts, newAccount("balance")])} text="Investment account" />
              <AddBtn onClick={() => setAccounts([...accounts, newAccount("income")])} text="Income stream" />
            </div>
            <p style={{ fontSize: 11, color: T.mute, margin: "4px 2px 0" }}>
              Projections are nominal, before tax, and illustrative only. Percent withdrawals recompute from the current balance each year. A schedule that references a deleted key age is treated as open-ended.
            </p>
          </div>

          {/* data */}
          <PlanDataCard plan={plan} persisted={persisted}
            onImport={(next) => setPlan(next)}
            onReset={() => setPlan(defaultPlan())} />
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
