import { useT } from "../theme.js";
import { fmtFull } from "../lib/format.js";

export function ChartTip({ active, payload, label, accounts, totalLabel }) {
  const T = useT();
  if (!active || !payload || !payload.length) return null;
  const nameOf = (id) => accounts.find((a) => a.id === id)?.name || id;
  const rows = payload.filter((p) => p.value > 0);
  const total = rows.reduce((t, p) => t + p.value, 0);
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 8,
      padding: "8px 10px", fontSize: 12, boxShadow: T.shadow, color: T.ink,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Age {label}</div>
      {rows.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span style={{ color: p.color }}>{nameOf(p.dataKey)}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFull(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 4, paddingTop: 4, display: "flex", gap: 8, justifyContent: "space-between", fontWeight: 600 }}>
        <span>{totalLabel}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFull(total)}</span>
      </div>
    </div>
  );
}

/* Tooltip for the income panel: after-tax income by source, taxes, spending and the gap. */
export function IncomeTip({ active, payload, label, accounts }) {
  const T = useT();
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload || {};
  const nameOf = (id) => accounts.find((a) => a.id === id)?.name || id;
  const rows = payload.filter((p) => p.dataKey !== "__taxes" && p.dataKey !== "__spending" && p.value > 0);
  const line = (k, v, style) => (
    <div key={k} style={{ display: "flex", gap: 8, justifyContent: "space-between", ...style }}>
      <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
  const gap = (row.__net || 0) - (row.__spending || 0);
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 8,
      padding: "8px 10px", fontSize: 12, boxShadow: T.shadow, color: T.ink, minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Age {label}</div>
      {rows.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span style={{ color: p.color }}>{nameOf(p.dataKey)}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFull(p.value)}</span>
        </div>
      ))}
      {row.__taxes > 0 && line("Taxes", fmtFull(row.__taxes), { color: T.mute })}
      <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 4, paddingTop: 4 }}>
        {line("After tax", fmtFull(row.__net || 0), { fontWeight: 600 })}
        {row.__spending > 0 && line("Spending", fmtFull(row.__spending), { color: T.danger })}
        {row.__spending > 0 && line(gap >= 0 ? "Surplus" : "Shortfall", fmtFull(Math.abs(gap)),
          { fontWeight: 600, color: gap >= 0 ? T.accent : T.danger })}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, warn }) {
  const T = useT();
  return (
    <div style={{
      flex: "1 1 20%", background: T.card, border: `1px solid ${warn ? T.dangerLine : T.line}`,
      borderRadius: 10, padding: "10px 12px", minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: warn ? T.danger : T.mute, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: warn ? T.danger : T.ink }}>
        {value}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: T.mute }}> {sub}</span>}
      </div>
    </div>
  );
}
