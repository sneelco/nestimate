import { useState } from "react";
import { useT } from "../theme.js";
import { fmtAxis, num } from "../lib/format.js";
import { TAX_TYPES, newSchedule, taxTypeLabel } from "../lib/plan.js";
import { AddBtn, Field, NumInput, Select, useInputStyle } from "./ui.jsx";
import ScheduleRow from "./ScheduleRow.jsx";

function summarize(account) {
  const parts = [];
  if (account.type === "balance") {
    parts.push(fmtAxis(num(account.balance)));
    parts.push(`${num(account.growth)}%/yr`);
    parts.push(taxTypeLabel(account.taxType));
    if (account.drawdown === false) parts.push("no drawdown");
  } else {
    if (num(account.cola) > 0) parts.push(`${num(account.cola)}% COLA`);
    const pct = num(account.taxablePct, 100);
    parts.push(pct === 0 ? "tax-free" : `${pct}% taxable`);
  }
  const n = account.schedules.length;
  parts.push(n === 1 ? "1 schedule" : `${n} schedules`);
  return parts.join(" · ");
}

export default function AccountCard({ account, color, keyAges, onChange, onDelete, onMove, isFirst, isLast }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const set = (k, v) => onChange({ ...account, [k]: v });
  const setSched = (s) =>
    onChange({ ...account, schedules: account.schedules.map((x) => (x.id === s.id ? s : x)) });
  const addSched = (kind) =>
    onChange({ ...account, schedules: [...account.schedules, newSchedule(kind)] });
  const delSched = (id) =>
    onChange({ ...account, schedules: account.schedules.filter((x) => x.id !== id) });
  const inputStyle = useInputStyle();

  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {open ? (
            <input value={account.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => set("name", e.target.value)}
              style={{ ...inputStyle, border: "none", padding: 0, fontWeight: 600, fontSize: 15, background: "transparent" }} />
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {account.name}
              </div>
              <div style={{ fontSize: 11.5, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
                {summarize(account)}
              </div>
            </>
          )}
        </div>
        <span style={{
          fontSize: 11, color: T.mute, border: `1px solid ${T.line}`, borderRadius: 999,
          padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {account.type === "balance" ? "Investment" : "Income"}
        </span>
        <span style={{ color: T.mute, fontSize: 13, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {account.type === "balance" ? (
              <>
                <Field label="Current balance ($)" w="32%">
                  <NumInput value={account.balance} onChange={(v) => set("balance", v)} />
                </Field>
                <Field label="Growth rate (%/yr)" w="30%">
                  <NumInput value={account.growth} onChange={(v) => set("growth", v)} step="0.1" />
                </Field>
                <Field label="Tax treatment" w="32%">
                  <Select value={account.taxType || "taxable"} onChange={(v) => set("taxType", v)}
                    options={TAX_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Annual increase (%/yr, COLA)" w="48%">
                  <NumInput value={account.cola} onChange={(v) => set("cola", v)} step="0.1" />
                </Field>
                <Field label="Taxable portion (%)" w="48%">
                  <NumInput value={account.taxablePct ?? 100} onChange={(v) => set("taxablePct", v)} step="1" />
                </Field>
              </>
            )}
          </div>
          {account.type === "balance" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, cursor: "pointer" }}>
              <input type="checkbox" checked={account.drawdown !== false}
                onChange={(e) => set("drawdown", e.target.checked)} />
              Use for automatic drawdown to cover spending
            </label>
          )}

          {account.schedules.map((s) => (
            <ScheduleRow key={s.id} sched={s} keyAges={keyAges}
              onChange={setSched} onDelete={() => delSched(s.id)} />
          ))}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {account.type === "balance" ? (
              <>
                <AddBtn onClick={() => addSched("contribution")} text="Add contribution" />
                <AddBtn onClick={() => addSched("withdrawal")} text="Add withdrawal" />
              </>
            ) : (
              <AddBtn onClick={() => addSched("payment")} text="Add payment" />
            )}
            <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
              <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" title="Move up (earlier in drawdown order)"
                style={{ border: `1px solid ${T.line}`, background: T.card, color: isFirst ? T.line : T.mute, borderRadius: 6, fontSize: 12, padding: "4px 8px", cursor: isFirst ? "default" : "pointer" }}>▲</button>
              <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" title="Move down (later in drawdown order)"
                style={{ border: `1px solid ${T.line}`, background: T.card, color: isLast ? T.line : T.mute, borderRadius: 6, fontSize: 12, padding: "4px 8px", cursor: isLast ? "default" : "pointer" }}>▼</button>
              <button type="button" onClick={onDelete} style={{
                border: "none", background: "none", color: T.danger, fontSize: 12, cursor: "pointer", marginLeft: 6,
              }}>Delete account</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
