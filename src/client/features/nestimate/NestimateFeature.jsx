import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { THEMES, ThemeCtx, systemTheme } from "./theme.js";
import { fmtAxis, num } from "../../../shared/nestimate/format.js";
import { ageFromBirthday, buildKeyMap, collectMilestones, defaultPlan, newAccount, rmdStartAge } from "../../../shared/nestimate/plan.js";
import { simulate } from "../../../shared/nestimate/simulate.js";
import { loadTheme, saveTheme } from "../../../shared/nestimate/storage.js";
import { useAppState, useAppData, setAppData } from "../../store/useAppState";
import { AddBtn, Card, EggMark, Field, NumInput } from "./components/ui.jsx";
import KeyAgesCard from "./components/KeyAgesCard.jsx";
import AccountCard from "./components/AccountCard.jsx";
import PlanDataCard from "./components/PlanDataCard.jsx";
import SpendingCard from "./components/SpendingCard.jsx";
import TaxCard from "./components/TaxCard.jsx";
import { ChartTip, IncomeTip, Stat } from "./components/charts.jsx";

/**
 * Nestimate's whole UI. The plan lives in the Outpost store (`state.plan`),
 * which persists to localStorage on every change and syncs when signed in.
 */
export default function NestimateFeature() {
  const [mode, setMode] = useState(() => loadTheme() || systemTheme());
  const T = THEMES[mode];

  // The whole editable plan lives in one object so it can be persisted,
  // exported, and imported as a unit.
  const plan = useAppData((d) => d.plan);
  const persisted = useAppState((s) => s.persisted);
  const setPlan = (next) => setAppData((d) => ({ ...d, plan: typeof next === "function" ? next(d.plan) : next }));
  const { birthday, endAge, keyAges, accounts, spending, tax, drawdown } = plan;
  const patch = (p) => setPlan((prev) => ({ ...prev, ...p }));
  const setAccounts = (accounts) => patch({ accounts });
  const setKeyAges = (keyAges) => patch({ keyAges });
  const setSpending = (spending) => patch({ spending });
  const setTax = (tax) => patch({ tax });
  const setDrawdown = (drawdown) => patch({ drawdown });
  const moveAccount = (id, dir) => {
    const i = accounts.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= accounts.length) return;
    const next = accounts.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setAccounts(next);
  };

  useEffect(() => {
    saveTheme(mode);
    // Keep the Outpost chrome (Tailwind `.dark` variant) in step with the toggle.
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const currentAge = ageFromBirthday(birthday);
  const keyMap = useMemo(() => buildKeyMap(keyAges), [keyAges]);
  const colorOf = {};
  accounts.forEach((a, i) => { colorOf[a.id] = T.palette[i % T.palette.length]; });

  const sim = useMemo(() => {
    if (currentAge === null || currentAge <= 0 || currentAge >= num(endAge, 95)) return null;
    return simulate({ accounts, keyMap, startAge: currentAge, endAge: num(endAge, 95), spending, tax, drawdown, birthday });
  }, [accounts, keyMap, birthday, endAge, spending, tax, drawdown]); // eslint-disable-line

  // Both charts use one explicit age domain so their vertical lines and hover positions line up.
  const xDomain = sim ? [Math.floor(sim.worthRows[0].age), num(endAge, 95)] : [0, 1];

  const milestones = useMemo(() => collectMilestones(accounts, keyAges, spending), [accounts, keyAges, spending]);
  const hasSpending = spending.some((sp) => num(sp.amount) > 0);
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
        color: T.ink,
        fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
        padding: "8px 0 32px", transition: "background .25s, color .25s",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px 2px" }}>
            <EggMark />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: T.mute }}>Size up the nest egg. Nothing leaves your device unless you sign in to sync.</p>
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
              {sim.shortfallAge !== null && (
                <Stat label="Spending not covered" value={`from ${sim.shortfallAge}`} warn />
              )}
              {sim.shortfallAge === null && sim.depletionAge !== null && (
                <Stat label="Balances depleted" value={`age ${sim.depletionAge}`} warn />
              )}
              {sim.totalTaxes > 0 && (
                <Stat label="Lifetime taxes" value={fmtAxis(sim.totalTaxes)} />
              )}
            </div>
          )}

          {/* projection: net worth stacked on top of annual income, sharing one x-axis */}
          {sim && (
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 10px 8px 6px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sim.worthRows} syncId="nestimate" syncMethod="value"
                  margin={{ top: 22, right: 8, left: 0, bottom: 6 }}>
                  <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="age" type="number" domain={xDomain} hide />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: T.mute }} width={46} tickCount={4} />
                  <Tooltip content={<ChartTip accounts={accounts} totalLabel="Total" />} />
                  {refLines(true)}
                  {balanceAccounts.map((a) => (
                    <Area key={a.id} dataKey={a.id} stackId="1" type="monotone"
                      stroke={colorOf[a.id]} fill={colorOf[a.id]} fillOpacity={0.5} strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              {sim.incomeRows.length > 0 && (
                <>
                  <div style={{ borderTop: `1px solid ${T.line}`, margin: "4px 0 0 10px" }} />
                  <ResponsiveContainer width="100%" height={114}>
                    <ComposedChart data={sim.incomeRows} syncId="nestimate" syncMethod="value"
                      margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={T.line} strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="age" type="number" domain={xDomain}
                        tickCount={8} tick={{ fontSize: 11, fill: T.mute }} tickFormatter={(v) => Math.round(v)} />
                      <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: T.mute }} width={46} tickCount={3} />
                      <Tooltip content={<IncomeTip accounts={accounts} />} />
                      {refLines(false)}
                      {accounts.map((a) => (
                        <Area key={a.id} dataKey={a.id} stackId="1" type="step"
                          stroke={colorOf[a.id]} fill={colorOf[a.id]} fillOpacity={0.5} strokeWidth={1.5} />
                      ))}
                      <Area dataKey="__taxes" stackId="1" type="step"
                        stroke={T.mute} fill={T.mute} fillOpacity={0.25} strokeWidth={1} strokeDasharray="2 2" />
                      {hasSpending && (
                        <Line dataKey="__spending" type="step" stroke={T.danger} strokeWidth={1.5}
                          strokeDasharray="5 3" dot={false} activeDot={false} isAnimationActive={false} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
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
              {sim && sim.totalTaxes > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.mute }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: T.mute, opacity: 0.5 }} />
                  Taxes
                </span>
              )}
              {hasSpending && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.danger }}>
                  <span style={{ width: 12, borderTop: `2px dashed ${T.danger}` }} />
                  Spending
                </span>
              )}
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

          {/* spending + taxes */}
          <SpendingCard spending={spending} setSpending={setSpending} keyAges={keyAges}
            drawdown={drawdown} setDrawdown={setDrawdown} />
          <TaxCard tax={tax} setTax={setTax} rmdAge={rmdStartAge(birthday)} />

          {/* accounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accounts</h2>
            {accounts.map((a, i) => (
              <AccountCard key={a.id} account={a} color={colorOf[a.id]} keyAges={keyAges}
                isFirst={i === 0} isLast={i === accounts.length - 1}
                onMove={(dir) => moveAccount(a.id, dir)}
                onChange={(next) => setAccounts(accounts.map((x) => (x.id === a.id ? next : x)))}
                onDelete={() => setAccounts(accounts.filter((x) => x.id !== a.id))} />
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <AddBtn onClick={() => setAccounts([...accounts, newAccount("balance")])} text="Investment account" />
              <AddBtn onClick={() => setAccounts([...accounts, newAccount("income")])} text="Income stream" />
            </div>
            <p style={{ fontSize: 11, color: T.mute, margin: "4px 2px 0" }}>
              Projections are nominal and illustrative only. Taxes are flat effective rates, not brackets, and the gains rate applies to whole taxable-account withdrawals rather than just the gain. Percent withdrawals recompute from the current balance each year. A schedule that references a deleted key age is treated as open-ended.
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
