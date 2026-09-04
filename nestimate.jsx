import React, { useState, useMemo, createContext, useContext } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

/* ---------- theming ---------- */
const THEMES = {
  light: {
    bg: "#f4f6f7", card: "#ffffff", sub: "#fbfcfd",
    ink: "#182430", mute: "#5c6b78", line: "#dde3e8",
    accent: "#0f6b66", accentSoft: "#e7f2f1", danger: "#b8336a", dangerLine: "#e7b4c7",
    shadow: "0 2px 8px rgba(24,36,48,.08)",
    palette: ["#0f6b66", "#5b5bd6", "#b45309", "#b8336a", "#3b7dd8", "#64748b", "#7c3aed", "#0e7490"],
  },
  dark: {
    bg: "#10161c", card: "#1a222b", sub: "#151d25",
    ink: "#e8edf2", mute: "#93a2b0", line: "#2b3642",
    accent: "#3ec3b7", accentSoft: "#12332f", danger: "#ef7ba6", dangerLine: "#5a2c40",
    shadow: "0 2px 10px rgba(0,0,0,.4)",
    palette: ["#3ec3b7", "#8a8af0", "#e0913a", "#ef7ba6", "#6ba3ec", "#93a2b0", "#a78bfa", "#3fb3cf"],
  },
};
const ThemeCtx = createContext(THEMES.light);
const useT = () => useContext(ThemeCtx);

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtFull = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtAxis = (n) => {
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + Math.round(n);
};
const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

/* ---------- key ages ----------
   Schedule start/end values are one of:
   ""          -> open (now / never ends)
   "@<keyId>"  -> reference to a key age
   "57.5"      -> explicit age                                        */
function resolveAge(v, keyMap) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" && v.startsWith("@")) {
    const a = keyMap[v.slice(1)];
    return a === undefined ? null : a;
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
const buildKeyMap = (keyAges) => {
  const m = {};
  keyAges.forEach((k) => { if (k.age !== "" && !isNaN(parseFloat(k.age))) m[k.id] = num(k.age); });
  return m;
};

/* ---------- frequency ---------- */
const FREQS = [
  { id: "weekly", label: "week", perMonth: 52 / 12 },
  { id: "biweekly", label: "2 weeks", perMonth: 26 / 12 },
  { id: "monthly", label: "month", perMonth: 1 },
  { id: "yearly", label: "year", perMonth: 1 / 12 },
];
const perMonthOf = (freq) => (FREQS.find((f) => f.id === freq) || FREQS[2]).perMonth;

/* ---------- default plan ---------- */
const KA = { ret: uid(), ss: uid() };
const defaultKeyAges = [
  { id: KA.ret, name: "Retirement", age: 55 },
  { id: KA.ss, name: "Social Security", age: 67 },
];
const defaultAccounts = [
  {
    id: uid(), name: "401(k)", type: "balance", balance: 250000, growth: 7,
    schedules: [
      { id: uid(), kind: "contribution", amount: 1200, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + KA.ret },
      { id: uid(), kind: "withdrawal", amount: 4, amountType: "percent", freq: "monthly", startAge: 59.5, endAge: "" },
    ],
  },
  {
    id: uid(), name: "Brokerage", type: "balance", balance: 150000, growth: 6.5,
    schedules: [
      { id: uid(), kind: "contribution", amount: 800, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + KA.ret },
      { id: uid(), kind: "withdrawal", amount: 3000, amountType: "fixed", freq: "monthly", startAge: "@" + KA.ret, endAge: "@" + KA.ss },
    ],
  },
  {
    id: uid(), name: "Social Security", type: "income", cola: 2,
    schedules: [
      { id: uid(), kind: "payment", amount: 2800, amountType: "fixed", freq: "monthly", startAge: "@" + KA.ss, endAge: "" },
    ],
  },
];

/* ---------- simulation ---------- */
function ageFromBirthday(birthday) {
  const b = new Date(birthday + "T00:00:00");
  if (isNaN(b)) return null;
  return (Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function simulate(accounts, keyMap, startAge, endAge) {
  const months = Math.max(1, Math.ceil((endAge - startAge) * 12));
  const balances = {};
  accounts.forEach((a) => { if (a.type === "balance") balances[a.id] = num(a.balance); });

  const worthRows = [];
  const incomeByYear = {};
  let depletionAge = null;

  const bounds = (s) => {
    const sa = resolveAge(s.startAge, keyMap);
    const ea = resolveAge(s.endAge, keyMap);
    return [sa === null ? -Infinity : sa, ea === null ? Infinity : ea];
  };

  let lastAge = null;
  const record = (age) => {
    const rounded = Math.round(age * 100) / 100;
    if (rounded === lastAge) return;
    lastAge = rounded;
    const row = { age: rounded };
    let total = 0;
    accounts.forEach((a) => {
      if (a.type === "balance") { row[a.id] = Math.round(balances[a.id]); total += balances[a.id]; }
    });
    row.__total = Math.round(total);
    worthRows.push(row);
  };

  record(startAge);

  for (let m = 1; m <= months; m++) {
    const age = startAge + m / 12;
    const yearsFromNow = m / 12;
    const bucket = Math.floor(age);
    if (!incomeByYear[bucket]) incomeByYear[bucket] = {};

    accounts.forEach((a) => {
      if (a.type === "balance") {
        balances[a.id] *= Math.pow(1 + num(a.growth) / 100, 1 / 12);
        a.schedules.forEach((s) => {
          const [sa, ea] = bounds(s);
          if (age < sa || age >= ea) return;
          if (s.kind === "contribution") {
            balances[a.id] += num(s.amount) * perMonthOf(s.freq);
          } else if (s.kind === "withdrawal") {
            let amt = s.amountType === "percent"
              ? (balances[a.id] * num(s.amount)) / 100 / 12
              : num(s.amount) * perMonthOf(s.freq);
            amt = Math.min(balances[a.id], Math.max(0, amt));
            balances[a.id] -= amt;
            incomeByYear[bucket][a.id] = (incomeByYear[bucket][a.id] || 0) + amt;
          }
        });
        if (balances[a.id] < 0.5) balances[a.id] = 0;
      } else {
        const colaMult = Math.pow(1 + num(a.cola) / 100, yearsFromNow);
        a.schedules.forEach((s) => {
          const [sa, ea] = bounds(s);
          if (age < sa || age >= ea) return;
          incomeByYear[bucket][a.id] =
            (incomeByYear[bucket][a.id] || 0) + num(s.amount) * perMonthOf(s.freq) * colaMult;
        });
      }
    });

    if (depletionAge === null) {
      const total = accounts.reduce((t, a) => t + (a.type === "balance" ? balances[a.id] : 0), 0);
      const withdrawing = accounts.some((a) =>
        a.type === "balance" && a.schedules.some((s) => {
          const [sa, ea] = bounds(s);
          return s.kind === "withdrawal" && age >= sa && age < ea;
        })
      );
      if (total < 1 && withdrawing) depletionAge = Math.round(age * 10) / 10;
    }

    // Snap yearly points to whole ages so both charts share x values (needed for tooltip sync)
    if (Math.abs(age - Math.round(age)) < 1 / 24) record(Math.round(age));
    else if (m === months) record(age);
  }

  const incomeRows = Object.keys(incomeByYear)
    .map(Number).sort((a, b) => a - b)
    .map((yr) => {
      const row = { age: yr };
      let total = 0;
      accounts.forEach((a) => {
        const v = incomeByYear[yr][a.id] || 0;
        row[a.id] = Math.round(v);
        total += v;
      });
      row.__total = Math.round(total);
      return row;
    });

  return { worthRows, incomeRows, depletionAge };
}

function collectMilestones(accounts, keyAges) {
  const keyMap = buildKeyMap(keyAges);
  const keyName = (v) =>
    typeof v === "string" && v.startsWith("@")
      ? keyAges.find((k) => k.id === v.slice(1))?.name : null;
  const items = [];
  accounts.forEach((a) => {
    a.schedules.forEach((s) => {
      const verb = s.kind === "contribution" ? "contributions"
        : s.kind === "withdrawal" ? "withdrawals" : "payments";
      const add = (v, which) => {
        const age = resolveAge(v, keyMap);
        if (age === null) return;
        const kn = keyName(v);
        items.push({ age, label: `${a.name}: ${verb} ${which}${kn ? ` (${kn})` : ""}` });
      };
      add(s.startAge, "start");
      add(s.endAge, "end");
    });
  });
  items.sort((x, y) => x.age - y.age);
  return items;
}

/* ---------- brand mark ---------- */
function EggMark({ size = 26 }) {
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

/* ---------- small UI pieces ---------- */
function Field({ label, children, w }) {
  const T = useT();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, width: w || "auto", minWidth: 0 }}>
      <span style={{ fontSize: 11, color: T.mute, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

function useInputStyle() {
  const T = useT();
  return {
    border: `1px solid ${T.line}`, borderRadius: 6, padding: "7px 9px",
    fontSize: 14, color: T.ink, background: T.card, width: "100%",
    fontVariantNumeric: "tabular-nums", outline: "none", boxSizing: "border-box",
    colorScheme: T === THEMES.dark ? "dark" : "light",
  };
}

function NumInput({ value, onChange, placeholder, step }) {
  const inputStyle = useInputStyle();
  return (
    <input type="number" inputMode="decimal" step={step || "any"}
      value={value} placeholder={placeholder || ""}
      onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  );
}

function Select({ value, onChange, options }) {
  const inputStyle = useInputStyle();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, padding: "7px 6px" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* Age picker: open / key age / specific number */
function AgeInput({ value, onChange, blankLabel, keyAges }) {
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

function AddBtn({ onClick, text }) {
  const T = useT();
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${T.line}`, background: T.card, color: T.accent, fontWeight: 600,
      fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
    }}>+ {text}</button>
  );
}

/* ---------- key ages card ---------- */
function KeyAgesCard({ keyAges, setKeyAges }) {
  const T = useT();
  const inputStyle = useInputStyle();
  const set = (id, k, v) => setKeyAges(keyAges.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Key ages</h2>
        <p style={{ fontSize: 12, color: T.mute, margin: "2px 0 0" }}>
          Name a milestone once, reference it from any schedule. Change it here and everything shifts.
        </p>
      </div>
      {keyAges.map((k) => (
        <div key={k.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={k.name} placeholder="Name"
            onChange={(e) => set(k.id, "name", e.target.value)}
            style={{ ...inputStyle, flex: 1 }} />
          <input type="number" inputMode="decimal" step="0.5" value={k.age} placeholder="age"
            onChange={(e) => set(k.id, "age", e.target.value)}
            style={{ ...inputStyle, width: 76, flexShrink: 0 }} />
          <button onClick={() => setKeyAges(keyAges.filter((x) => x.id !== k.id))}
            style={{ border: "none", background: "none", color: T.mute, fontSize: 16, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}
            aria-label="Remove key age">×</button>
        </div>
      ))}
      <div>
        <AddBtn onClick={() => setKeyAges([...keyAges, { id: uid(), name: "", age: "" }])} text="Key age" />
      </div>
    </div>
  );
}

/* ---------- tooltip ---------- */
function ChartTip({ active, payload, label, accounts, totalLabel }) {
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

/* ---------- schedule editor ---------- */
function ScheduleRow({ sched, keyAges, onChange, onDelete }) {
  const T = useT();
  const set = (k, v) => onChange({ ...sched, [k]: v });
  const isWithdrawal = sched.kind === "withdrawal";
  const isPercent = isWithdrawal && sched.amountType === "percent";
  const kindLabel = sched.kind === "contribution" ? "Contribution"
    : sched.kind === "withdrawal" ? "Withdrawal" : "Payment";
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 8, padding: 10,
      display: "flex", flexDirection: "column", gap: 8, background: T.sub,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{kindLabel}</span>
        <button onClick={onDelete} style={{
          border: "none", background: "none", color: T.mute, fontSize: 12, cursor: "pointer", padding: 2,
        }}>Remove</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label={isPercent ? "% of balance / yr" : "Amount ($)"} w={isPercent ? "100%" : "55%"}>
          <NumInput value={sched.amount} onChange={(v) => set("amount", v)} />
        </Field>
        {!isPercent && (
          <Field label="Every" w="45%">
            <Select value={sched.freq || "monthly"} onChange={(v) => set("freq", v)}
              options={FREQS.map((f) => ({ value: f.id, label: f.label }))} />
          </Field>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Starts" w="50%">
          <AgeInput value={sched.startAge} onChange={(v) => set("startAge", v)}
            blankLabel="Now" keyAges={keyAges} />
        </Field>
        <Field label="Ends" w="50%">
          <AgeInput value={sched.endAge} onChange={(v) => set("endAge", v)}
            blankLabel="Never" keyAges={keyAges} />
        </Field>
      </div>
      {isWithdrawal && (
        <div style={{ display: "flex", gap: 6 }}>
          {["fixed", "percent"].map((t) => (
            <button key={t} onClick={() => set("amountType", t)} style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${sched.amountType === t ? T.accent : T.line}`,
              background: sched.amountType === t ? T.accentSoft : T.card,
              color: sched.amountType === t ? T.accent : T.mute, fontWeight: 600,
            }}>
              {t === "fixed" ? "Fixed amount" : "% of balance/yr"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- account card ---------- */
function summarize(account) {
  const parts = [];
  if (account.type === "balance") {
    parts.push(fmtAxis(num(account.balance)));
    parts.push(`${num(account.growth)}%/yr`);
  } else if (num(account.cola) > 0) {
    parts.push(`${num(account.cola)}% COLA`);
  }
  const n = account.schedules.length;
  parts.push(n === 1 ? "1 schedule" : `${n} schedules`);
  return parts.join(" · ");
}

function AccountCard({ account, color, keyAges, onChange, onDelete }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const set = (k, v) => onChange({ ...account, [k]: v });
  const setSched = (s) =>
    onChange({ ...account, schedules: account.schedules.map((x) => (x.id === s.id ? s : x)) });
  const addSched = (kind) =>
    onChange({
      ...account,
      schedules: [...account.schedules, {
        id: uid(), kind, amount: "", amountType: "fixed", freq: "monthly", startAge: "", endAge: "",
      }],
    });
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
          <div style={{ display: "flex", gap: 8 }}>
            {account.type === "balance" ? (
              <>
                <Field label="Current balance ($)" w="50%">
                  <NumInput value={account.balance} onChange={(v) => set("balance", v)} />
                </Field>
                <Field label="Growth rate (%/yr)" w="50%">
                  <NumInput value={account.growth} onChange={(v) => set("growth", v)} step="0.1" />
                </Field>
              </>
            ) : (
              <Field label="Annual increase (%/yr, COLA)" w="50%">
                <NumInput value={account.cola} onChange={(v) => set("cola", v)} step="0.1" />
              </Field>
            )}
          </div>

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
            <button onClick={onDelete} style={{
              marginLeft: "auto", border: "none", background: "none", color: T.danger,
              fontSize: 12, cursor: "pointer",
            }}>Delete account</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- stat + chart shells ---------- */
function Stat({ label, value, sub, warn }) {
  const T = useT();
  return (
    <div style={{
      flex: "1 1 30%", background: T.card, border: `1px solid ${warn ? T.dangerLine : T.line}`,
      borderRadius: 10, padding: "10px 12px", minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: warn ? T.danger : T.mute, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: warn ? T.danger : T.ink }}>
        {value}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: T.mute }}> {sub}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, note, children }) {
  const T = useT();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 10px 8px 6px" }}>
      <div style={{ padding: "0 8px 8px 10px" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: T.ink }}>{title}</h2>
        <p style={{ fontSize: 12, color: T.mute, margin: "2px 0 0" }}>{note}</p>
      </div>
      {children}
    </div>
  );
}

/* ---------- app ---------- */
export default function Nestimate() {
  const [mode, setMode] = useState("light");
  const T = THEMES[mode];
  const [birthday, setBirthday] = useState("1985-06-15");
  const [endAge, setEndAge] = useState(95);
  const [keyAges, setKeyAges] = useState(defaultKeyAges);
  const [accounts, setAccounts] = useState(defaultAccounts);

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

  const addAccount = (type) => {
    setAccounts([...accounts, {
      id: uid(),
      name: type === "balance" ? "New account" : "New income stream",
      type,
      balance: type === "balance" ? 0 : undefined,
      growth: type === "balance" ? 6 : undefined,
      cola: type === "income" ? 0 : undefined,
      schedules: [],
    }]);
  };

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
            <button onClick={() => setMode(mode === "light" ? "dark" : "light")}
              aria-label="Toggle dark mode"
              style={{
                border: `1px solid ${T.line}`, background: T.card, color: T.ink,
                borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer",
              }}>
              {mode === "light" ? "☾ Dark" : "☀ Light"}
            </button>
          </header>

          {/* setup */}
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Birthday" w="46%">
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Project to age" w="24%">
              <NumInput value={endAge} onChange={setEndAge} />
            </Field>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: 13, color: T.mute, paddingBottom: 8 }}>
              {currentAge !== null
                ? <span>You're <b style={{ color: T.ink }}>{currentAge.toFixed(1)}</b> today</span>
                : <span>Enter a valid birthday</span>}
            </div>
          </div>

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
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
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
          </div>

          {/* accounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accounts</h2>
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} color={colorOf[a.id]} keyAges={keyAges}
                onChange={(next) => setAccounts(accounts.map((x) => (x.id === a.id ? next : x)))}
                onDelete={() => setAccounts(accounts.filter((x) => x.id !== a.id))} />
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <AddBtn onClick={() => addAccount("balance")} text="Investment account" />
              <AddBtn onClick={() => addAccount("income")} text="Income stream" />
            </div>
            <p style={{ fontSize: 11, color: T.mute, margin: "4px 2px 0" }}>
              Projections are nominal, before tax, and illustrative only. Percent withdrawals recompute from the current balance each year. A schedule that references a deleted key age is treated as open-ended.
            </p>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
