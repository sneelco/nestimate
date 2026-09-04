import { useRef, useState } from "react";
import { useT } from "../theme.js";
import { downloadPlan, parsePlanFile } from "../lib/storage.js";
import { Card, GhostBtn } from "./ui.jsx";

/* Export / import / reset controls plus a short note on where data lives. */
export default function PlanDataCard({ plan, onImport, onReset, persisted }) {
  const T = useT();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }

  const flash = (kind, text) => {
    setMsg({ kind, text });
    if (kind === "ok") setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 4000);
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const next = parsePlanFile(await file.text());
      onImport(next);
      flash("ok", `Imported ${file.name}.`);
    } catch (err) {
      flash("err", err.message || "Couldn't import that file.");
    }
  };

  const reset = () => {
    if (window.confirm("Replace your plan with the sample plan? Export first if you want to keep it.")) {
      onReset();
      flash("ok", "Plan reset to the sample.");
    }
  };

  return (
    <Card style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 240px", fontSize: 12, color: T.mute }}>
        {persisted
          ? "Your plan is saved in this browser automatically. Export a copy to back it up or move it to another device."
          : "This browser isn't allowing local storage, so changes will be lost when you leave. Export to keep a copy."}
        {msg && (
          <div style={{ marginTop: 4, color: msg.kind === "err" ? T.danger : T.accent, fontWeight: 600 }}>
            {msg.text}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <GhostBtn onClick={() => downloadPlan(plan)} title="Download your plan as a JSON file">Export</GhostBtn>
        <GhostBtn onClick={() => fileRef.current && fileRef.current.click()} title="Load a plan from a JSON file">Import</GhostBtn>
        <GhostBtn onClick={reset} danger title="Replace your plan with the sample plan">Reset</GhostBtn>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
      </div>
    </Card>
  );
}
