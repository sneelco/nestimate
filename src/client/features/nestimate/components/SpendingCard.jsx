import { useT } from "../theme.js";
import { FREQS, newSpending } from "../../../../shared/nestimate/plan.js";
import { AddBtn, AgeInput, Card, Field, NumInput, Select, useInputStyle } from "./ui.jsx";

function SpendingRow({ item, keyAges, onChange, onDelete }) {
  const T = useT();
  const inputStyle = useInputStyle();
  const set = (k, v) => onChange({ ...item, [k]: v });
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 8, padding: 10,
      display: "flex", flexDirection: "column", gap: 8, background: T.sub,
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={item.name} placeholder="What for (e.g. Living expenses)"
          onChange={(e) => set("name", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button type="button" onClick={onDelete} style={{
          border: "none", background: "none", color: T.mute, fontSize: 12, cursor: "pointer", padding: 2, flexShrink: 0,
        }}>Remove</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Amount ($)" w="40%">
          <NumInput value={item.amount} onChange={(v) => set("amount", v)} />
        </Field>
        <Field label="Every" w="30%">
          <Select value={item.freq || "monthly"} onChange={(v) => set("freq", v)}
            options={FREQS.map((f) => ({ value: f.id, label: f.label }))} />
        </Field>
        <Field label="Increase (%/yr)" w="30%">
          <NumInput value={item.increase} onChange={(v) => set("increase", v)} step="0.1" />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Starts" w="50%">
          <AgeInput value={item.startAge} onChange={(v) => set("startAge", v)} blankLabel="Now" keyAges={keyAges} />
        </Field>
        <Field label="Ends" w="50%">
          <AgeInput value={item.endAge} onChange={(v) => set("endAge", v)} blankLabel="Never" keyAges={keyAges} />
        </Field>
      </div>
    </div>
  );
}

export default function SpendingCard({ spending, setSpending, keyAges, drawdown, setDrawdown }) {
  const T = useT();
  const setItem = (item) => setSpending(spending.map((x) => (x.id === item.id ? item : x)));
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Spending</h2>
        <p style={{ fontSize: 12, color: T.mute, margin: "2px 0 0" }}>
          What you need to live on, after tax. Income streams and scheduled withdrawals go toward it first.
        </p>
      </div>
      {spending.map((item) => (
        <SpendingRow key={item.id} item={item} keyAges={keyAges}
          onChange={setItem} onDelete={() => setSpending(spending.filter((x) => x.id !== item.id))} />
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <AddBtn onClick={() => setSpending([...spending, newSpending()])} text="Spending item" />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, cursor: "pointer" }}>
          <input type="checkbox" checked={drawdown.enabled !== false}
            onChange={(e) => setDrawdown({ ...drawdown, enabled: e.target.checked })} />
          Cover any shortfall from accounts automatically
        </label>
      </div>
      {drawdown.enabled !== false && (
        <p style={{ fontSize: 11, color: T.mute, margin: 0 }}>
          Withdrawals are taken from investment accounts in the order they are listed below, grossed up for tax,
          skipping any account with drawdown turned off. Reorder accounts to change priority.
        </p>
      )}
    </Card>
  );
}
