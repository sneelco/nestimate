import { useState } from "react";
import { useT } from "../theme.js";

export function EggMark({ size = 26 }) {
  const T = useT();
  return (
    <svg width={size} height={(size * 30) / 26} viewBox="0 0 26 30" aria-hidden="true">
      <path
        d="M13 2 C6.5 9.5, 2.5 15, 2.5 20 a10.5 10.5 0 0 0 21 0 C23.5 15, 19.5 9.5, 13 2 Z"
        fill={T.accent}
      />
      <polyline
        points="7.5,21 11,16.5 14,18.5 18.5,12.5"
        fill="none" stroke={T.card} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function Card({ children, style }) {
  const T = useT();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, ...style }}>
      {children}
    </div>
  );
}

export function Field({ label, children, w }) {
  const T = useT();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, width: w || "auto", minWidth: 0 }}>
      <span style={{ fontSize: 11, color: T.mute, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

export function useInputStyle() {
  const T = useT();
  return {
    border: `1px solid ${T.line}`, borderRadius: 6, padding: "7px 9px",
    fontSize: 14, color: T.ink, background: T.card, width: "100%",
    fontVariantNumeric: "tabular-nums", outline: "none", boxSizing: "border-box",
    colorScheme: T.name,
  };
}

export function NumInput({ value, onChange, placeholder, step }) {
  const inputStyle = useInputStyle();
  return (
    <input type="number" inputMode="decimal" step={step || "any"}
      value={value} placeholder={placeholder || ""}
      onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  );
}

export function Select({ value, onChange, options }) {
  const inputStyle = useInputStyle();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, padding: "7px 6px" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* Age picker: open / key age / specific number */
export function AgeInput({ value, onChange, blankLabel, keyAges }) {
  const isKey = typeof value === "string" && value.startsWith("@");
  const isNumVal = value !== "" && !isKey;
  const [custom, setCustom] = useState(isNumVal);
  const inputStyle = useInputStyle();
  const selectValue = isKey ? value : custom ? "#custom" : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "#custom") { setCustom(true); onChange(""); }
          else { setCustom(false); onChange(v); }
        }}
        style={{ ...inputStyle, padding: "7px 6px" }}
      >
        <option value="">{blankLabel}</option>
        {keyAges.map((k) => (
          <option key={k.id} value={"@" + k.id}>
            {(k.name || "Key age") + (k.age !== "" ? ` (${k.age})` : "")}
          </option>
        ))}
        <option value="#custom">Specific age…</option>
      </select>
      {custom && (
        <NumInput value={isNumVal ? value : ""} onChange={onChange} placeholder="age" step="0.5" />
      )}
    </div>
  );
}

export function AddBtn({ onClick, text }) {
  const T = useT();
  return (
    <button type="button" onClick={onClick} style={{
      border: `1px solid ${T.line}`, background: T.card, color: T.accent, fontWeight: 600,
      fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
    }}>+ {text}</button>
  );
}

export function GhostBtn({ onClick, children, danger, title }) {
  const T = useT();
  return (
    <button type="button" onClick={onClick} title={title} style={{
      border: `1px solid ${T.line}`, background: T.card, color: danger ? T.danger : T.ink,
      fontWeight: 600, fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
    }}>{children}</button>
  );
}
