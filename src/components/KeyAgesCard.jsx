import { useT } from "../theme.js";
import { uid } from "../lib/format.js";
import { AddBtn, Card, useInputStyle } from "./ui.jsx";

export default function KeyAgesCard({ keyAges, setKeyAges }) {
  const T = useT();
  const inputStyle = useInputStyle();
  const set = (id, k, v) => setKeyAges(keyAges.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          <button type="button" onClick={() => setKeyAges(keyAges.filter((x) => x.id !== k.id))}
            style={{ border: "none", background: "none", color: T.mute, fontSize: 16, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}
            aria-label="Remove key age">×</button>
        </div>
      ))}
      <div>
        <AddBtn onClick={() => setKeyAges([...keyAges, { id: uid(), name: "", age: "" }])} text="Key age" />
      </div>
    </Card>
  );
}
