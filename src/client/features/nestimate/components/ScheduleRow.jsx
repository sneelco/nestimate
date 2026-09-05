import { useT } from "../theme.js";
import { FREQS } from "../../../../shared/nestimate/plan.js";
import { AgeInput, Field, NumInput, Select } from "./ui.jsx";

export default function ScheduleRow({ sched, keyAges, onChange, onDelete }) {
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
        <button type="button" onClick={onDelete} style={{
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
            <button type="button" key={t} onClick={() => set("amountType", t)} style={{
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
