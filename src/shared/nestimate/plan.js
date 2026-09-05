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

/* ---------- taxes ----------
   Investment accounts carry a tax treatment that decides how withdrawals are taxed:
   taxable  -> capital gains rate (applied to the whole withdrawal; conservative)
   deferred -> ordinary income rate, and subject to required minimum distributions
   roth     -> tax-free                                                            */
export const TAX_TYPES = [
  { id: "taxable", label: "Taxable" },
  { id: "deferred", label: "Tax-deferred" },
  { id: "roth", label: "Roth" },
];
export const taxTypeLabel = (id) => (TAX_TYPES.find((t) => t.id === id) || TAX_TYPES[0]).label;

/** Guess a tax treatment from an account name, for plans saved before tax types existed. */
export function guessTaxType(name = "") {
  const n = String(name).toLowerCase();
  if (/roth/.test(n)) return "roth";
  if (/401|403|457|ira|tsp|sep|simple|pension|deferred/.test(n)) return "deferred";
  return "taxable";
}

/** Age at which required minimum distributions start (SECURE 2.0). */
export function rmdStartAge(birthday) {
  const year = parseInt(String(birthday).slice(0, 4), 10);
  if (isNaN(year)) return 73;
  return year >= 1960 ? 75 : 73;
}

/* IRS Uniform Lifetime Table (2022 and later): distribution period by age. */
const RMD_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3,
  99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8,
  117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};
export function rmdDivisor(age) {
  const a = Math.max(72, Math.min(120, Math.floor(age)));
  return RMD_TABLE[a];
}

export const defaultTax = () => ({ incomeRate: 22, gainsRate: 15, rmd: true });
export const defaultDrawdown = () => ({ enabled: true });

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
    // Accounts are listed in drawdown order: automatic withdrawals to cover
    // spending come from the first eligible account with a balance.
    accounts: [
      {
        id: uid(), name: "Brokerage", type: "balance", taxType: "taxable", drawdown: true, drawdownFrom: "", balance: 150000, growth: 6.5,
        schedules: [
          { id: uid(), kind: "contribution", amount: 800, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + ret },
        ],
      },
      {
        id: uid(), name: "401(k)", type: "balance", taxType: "deferred", drawdown: true, drawdownFrom: 59.5, balance: 250000, growth: 7,
        schedules: [
          { id: uid(), kind: "contribution", amount: 1200, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + ret },
        ],
      },
      {
        id: uid(), name: "Roth IRA", type: "balance", taxType: "roth", drawdown: true, drawdownFrom: 59.5, balance: 60000, growth: 7,
        schedules: [
          { id: uid(), kind: "contribution", amount: 500, amountType: "fixed", freq: "monthly", startAge: "", endAge: "@" + ret },
        ],
      },
      {
        id: uid(), name: "Social Security", type: "income", cola: 2, taxablePct: 85,
        schedules: [
          { id: uid(), kind: "payment", amount: 2800, amountType: "fixed", freq: "monthly", startAge: "@" + ss, endAge: "" },
        ],
      },
    ],
    spending: [
      { id: uid(), name: "Living expenses", amount: 6000, freq: "monthly", increase: 2.5, startAge: "@" + ret, endAge: "" },
    ],
    tax: defaultTax(),
    drawdown: defaultDrawdown(),
  };
}

export function newSpending() {
  return { id: uid(), name: "", amount: "", freq: "monthly", increase: 2.5, startAge: "", endAge: "" };
}

export function newAccount(type) {
  return type === "balance"
    ? { id: uid(), name: "New account", type, taxType: "taxable", drawdown: true, drawdownFrom: "", balance: 0, growth: 6, schedules: [] }
    : { id: uid(), name: "New income stream", type, cola: 0, taxablePct: 100, schedules: [] };
}

export function newSchedule(kind) {
  return { id: uid(), kind, amount: "", amountType: "fixed", freq: "monthly", startAge: "", endAge: "" };
}

export function ageFromBirthday(birthday, now = Date.now()) {
  const b = new Date(birthday + "T00:00:00");
  if (isNaN(b)) return null;
  return (now - b.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function collectMilestones(accounts, keyAges, spending = []) {
  const keyMap = buildKeyMap(keyAges);
  const keyName = (v) =>
    typeof v === "string" && v.startsWith("@")
      ? keyAges.find((k) => k.id === v.slice(1))?.name : null;
  const items = [];
  const add = (v, label) => {
    const age = resolveAge(v, keyMap);
    if (age === null) return;
    const kn = keyName(v);
    items.push({ age, label: `${label}${kn ? ` (${kn})` : ""}` });
  };
  accounts.forEach((a) => {
    a.schedules.forEach((s) => {
      const verb = s.kind === "contribution" ? "contributions"
        : s.kind === "withdrawal" ? "withdrawals" : "payments";
      add(s.startAge, `${a.name}: ${verb} start`);
      add(s.endAge, `${a.name}: ${verb} end`);
    });
    if (a.type === "balance" && a.drawdown !== false) add(a.drawdownFrom, `${a.name}: available for drawdown`);
  });
  spending.forEach((sp) => {
    const name = sp.name || "Spending";
    add(sp.startAge, `${name}: spending starts`);
    add(sp.endAge, `${name}: spending ends`);
  });
  items.sort((x, y) => x.age - y.age);
  return items;
}
