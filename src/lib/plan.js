import { uid, num } from "./format.js";

/* ---------- key ages ----------
   Schedule start/end values are one of:
   ""          -> open (now / never ends)
   "@<keyId>"  -> reference to a key age
   "57.5"      -> explicit age                                        */
export function resolveAge(v, keyMap) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" && v.startsWith("@")) {
    const a = keyMap[v.slice(1)];
    return a === undefined ? null : a;
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export const buildKeyMap = (keyAges) => {
  const m = {};
  keyAges.forEach((k) => {
    if (k.age !== "" && !isNaN(parseFloat(k.age))) m[k.id] = num(k.age);
  });
  return m;
};

/* ---------- frequency ---------- */
export const FREQS = [
  { id: "weekly", label: "week", perMonth: 52 / 12 },
  { id: "biweekly", label: "2 weeks", perMonth: 26 / 12 },
  { id: "monthly", label: "month", perMonth: 1 },
  { id: "yearly", label: "year", perMonth: 1 / 12 },
];
export const perMonthOf = (freq) => (FREQS.find((f) => f.id === freq) || FREQS[2]).perMonth;

export const ACCOUNT_TYPES = ["balance", "income"];
export const SCHEDULE_KINDS = ["contribution", "withdrawal", "payment"];
export const AMOUNT_TYPES = ["fixed", "percent"];

/* ---------- default plan ---------- */
export function defaultPlan() {
  const ret = uid();
  const ss = uid();
  return {
    birthday: "1985-06-15",
    endAge: 95,
    keyAges: [
      { id: ret, name: "Retirement", age: 55 },
      { id: ss, name: "Social Security", age: 67 },
    ],
    accounts: [
      {
        id: uid(), name: "401(k)", type: "balance", balance: 250000, growth: 7,
        schedules: [
          { id: uid(), kind: "contribution", amount: 1200, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + ret },
          { id: uid(), kind: "withdrawal", amount: 4, amountType: "percent", freq: "monthly", startAge: 59.5, endAge: "" },
        ],
      },
      {
        id: uid(), name: "Brokerage", type: "balance", balance: 150000, growth: 6.5,
        schedules: [
          { id: uid(), kind: "contribution", amount: 800, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + ret },
          { id: uid(), kind: "withdrawal", amount: 3000, amountType: "fixed", freq: "monthly", startAge: "@" + ret, endAge: "@" + ss },
        ],
      },
      {
        id: uid(), name: "Social Security", type: "income", cola: 2,
        schedules: [
          { id: uid(), kind: "payment", amount: 2800, amountType: "fixed", freq: "monthly", startAge: "@" + ss, endAge: "" },
        ],
      },
    ],
  };
}

export function newAccount(type) {
  return {
    id: uid(),
    name: type === "balance" ? "New account" : "New income stream",
    type,
    balance: type === "balance" ? 0 : undefined,
    growth: type === "balance" ? 6 : undefined,
    cola: type === "income" ? 0 : undefined,
    schedules: [],
  };
}

export function newSchedule(kind) {
  return { id: uid(), kind, amount: "", amountType: "fixed", freq: "monthly", startAge: "", endAge: "" };
}

export function ageFromBirthday(birthday, now = Date.now()) {
  const b = new Date(birthday + "T00:00:00");
  if (isNaN(b)) return null;
  return (now - b.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function collectMilestones(accounts, keyAges) {
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
