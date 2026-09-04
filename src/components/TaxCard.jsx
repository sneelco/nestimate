import { useT } from "../theme.js";
import { Card, Field, NumInput } from "./ui.jsx";

export default function TaxCard({ tax, setTax, rmdAge }) {
  const T = useT();
  const set = (k, v) => setTax({ ...tax, [k]: v });
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Taxes</h2>
        <p style={{ fontSize: 12, color: T.mute, margin: "2px 0 0" }}>
          Effective rates applied to withdrawals and income. Tax-deferred withdrawals and the taxable share of
          income use the income rate; taxable-account withdrawals use the gains rate; Roth is tax-free.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="Income tax rate (%)" w="30%">
          <NumInput value={tax.incomeRate} onChange={(v) => set("incomeRate", v)} step="0.5" />
        </Field>
        <Field label="Capital gains rate (%)" w="30%">
          <NumInput value={tax.gainsRate} onChange={(v) => set("gainsRate", v)} step="0.5" />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, cursor: "pointer", paddingBottom: 9 }}>
          <input type="checkbox" checked={tax.rmd !== false} onChange={(e) => set("rmd", e.target.checked)} />
          Required minimum distributions from age {rmdAge}
        </label>
      </div>
    </Card>
  );
}
