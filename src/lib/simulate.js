import { num } from "./format.js";
import { resolveAge, perMonthOf, rmdStartAge, rmdDivisor } from "./plan.js";

/**
 * Month-by-month projection from startAge to endAge.
 *
 * Each month, per investment account: grow, add contributions, take scheduled
 * withdrawals. Income streams pay out with COLA. Then spending for the month is
 * compared with after-tax income; if drawdown is enabled the shortfall is taken
 * from eligible accounts in list order, grossed up for tax. Finally, required
 * minimum distributions top up tax-deferred withdrawals from the RMD age on.
 *
 * Returns yearly net-worth rows, yearly income rows (after-tax by source plus
 * __taxes, __spending, __shortfall, __net, __gross), and summary ages.
 */
export function simulate({ accounts, keyMap, startAge, endAge, spending = [], tax = {}, drawdown = {}, birthday = "" }) {
  const months = Math.max(1, Math.ceil((endAge - startAge) * 12));
  const incomeRate = Math.min(0.99, Math.max(0, num(tax.incomeRate) / 100));
  const gainsRate = Math.min(0.99, Math.max(0, num(tax.gainsRate) / 100));
  const applyRmd = tax.rmd !== false;
  const rmdAge = rmdStartAge(birthday);
  const autoDraw = drawdown.enabled !== false;

  const rateFor = (a) => (a.taxType === "deferred" ? incomeRate : a.taxType === "roth" ? 0 : gainsRate);

  const balances = {};
  accounts.forEach((a) => { if (a.type === "balance") balances[a.id] = num(a.balance); });

  const worthRows = [];
  const years = {}; // bucket -> { src: {id: net}, taxes, spending, shortfall, gross }
  let depletionAge = null;
  let shortfallAge = null;

  const bounds = (s) => {
    const sa = resolveAge(s.startAge, keyMap);
    const ea = resolveAge(s.endAge, keyMap);
    return [sa === null ? -Infinity : sa, ea === null ? Infinity : ea];
  };
  const active = (s, age) => { const [sa, ea] = bounds(s); return age >= sa && age < ea; };

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

  // RMD bookkeeping per deferred account: required for the current age-year and taken so far.
  const rmd = {};
  let rmdBucket = null;

  for (let m = 1; m <= months; m++) {
    const age = startAge + m / 12;
    const yearsFromNow = m / 12;
    const bucket = Math.floor(age);
    if (!years[bucket]) years[bucket] = { src: {}, taxes: 0, spending: 0, shortfall: 0, gross: 0, months: 0 };
    const yr = years[bucket];
    yr.months += 1;

    // Take `gross` out of account `a`, tax it, and credit the net to this month's income.
    let netThisMonth = 0;
    const withdraw = (a, gross) => {
      gross = Math.min(balances[a.id], Math.max(0, gross));
      if (gross <= 0) return 0;
      const t = gross * rateFor(a);
      balances[a.id] -= gross;
      yr.src[a.id] = (yr.src[a.id] || 0) + (gross - t);
      yr.taxes += t;
      yr.gross += gross;
      netThisMonth += gross - t;
      if (rmd[a.id]) rmd[a.id].taken += gross;
      return gross - t;
    };

    // Start of a new age-year: fix each deferred account's RMD from its balance now.
    if (applyRmd && age >= rmdAge && bucket !== rmdBucket) {
      rmdBucket = bucket;
      accounts.forEach((a) => {
        if (a.type === "balance" && a.taxType === "deferred") {
          rmd[a.id] = { required: balances[a.id] / rmdDivisor(bucket), taken: 0, months: 0 };
        }
      });
    }

    accounts.forEach((a) => {
      if (a.type === "balance") {
        balances[a.id] *= Math.pow(1 + num(a.growth) / 100, 1 / 12);
        a.schedules.forEach((s) => {
          if (!active(s, age)) return;
          if (s.kind === "contribution") {
            balances[a.id] += num(s.amount) * perMonthOf(s.freq);
          } else if (s.kind === "withdrawal") {
            const gross = s.amountType === "percent"
              ? (balances[a.id] * num(s.amount)) / 100 / 12
              : num(s.amount) * perMonthOf(s.freq);
            withdraw(a, gross);
          }
        });
      } else {
        const colaMult = Math.pow(1 + num(a.cola) / 100, yearsFromNow);
        a.schedules.forEach((s) => {
          if (!active(s, age)) return;
          const gross = num(s.amount) * perMonthOf(s.freq) * colaMult;
          const taxable = Math.min(100, Math.max(0, num(a.taxablePct, 100))) / 100;
          const t = gross * taxable * incomeRate;
          yr.src[a.id] = (yr.src[a.id] || 0) + (gross - t);
          yr.taxes += t;
          yr.gross += gross;
          netThisMonth += gross - t;
        });
      }
    });

    // Spending need for this month, each item escalated by its own annual increase.
    let need = 0;
    spending.forEach((sp) => {
      if (!active(sp, age)) return;
      need += num(sp.amount) * perMonthOf(sp.freq) * Math.pow(1 + num(sp.increase) / 100, yearsFromNow);
    });
    yr.spending += need;

    // Cover any gap from accounts in list order, grossing up so the net covers the need.
    let gap = need - netThisMonth;
    let attemptedDraw = false;
    if (autoDraw && gap > 0) {
      for (const a of accounts) {
        if (gap <= 0) break;
        if (a.type !== "balance" || a.drawdown === false || balances[a.id] <= 0) continue;
        attemptedDraw = true;
        const rate = rateFor(a);
        const net = withdraw(a, gap / (1 - rate));
        gap -= net;
      }
    }
    if (gap > 0.5 && need > 0) {
      yr.shortfall += gap;
      if (shortfallAge === null) shortfallAge = Math.round(age * 10) / 10;
    }

    // RMD top-up: by this point in the age-year, at least a pro-rated share must be out.
    if (applyRmd && age >= rmdAge) {
      accounts.forEach((a) => {
        const r = rmd[a.id];
        if (!r || a.type !== "balance" || a.taxType !== "deferred") return;
        r.months += 1;
        const due = r.required * Math.min(1, r.months / 12) - r.taken;
        if (due > 0.5) withdraw(a, due);
      });
    }

    accounts.forEach((a) => { if (a.type === "balance" && balances[a.id] < 0.5) balances[a.id] = 0; });

    if (depletionAge === null) {
      const total = accounts.reduce((t, a) => t + (a.type === "balance" ? balances[a.id] : 0), 0);
      const withdrawing = attemptedDraw || accounts.some((a) =>
        a.type === "balance" && a.schedules.some((s) => s.kind === "withdrawal" && active(s, age)));
      if (total < 1 && withdrawing) depletionAge = Math.round(age * 10) / 10;
    }

    // Snap yearly points to whole ages so both charts share x values (needed for tooltip sync)
    if (Math.abs(age - Math.round(age)) < 1 / 24) record(Math.round(age));
    else if (m === months) record(age);
  }

  const incomeRows = Object.keys(years).map(Number).sort((a, b) => a - b).map((b) => {
    const y = years[b];
    const row = { age: b };
    let net = 0;
    accounts.forEach((a) => {
      const v = y.src[a.id] || 0;
      row[a.id] = Math.round(v);
      net += v;
    });
    row.__net = Math.round(net);
    row.__taxes = Math.round(y.taxes);
    row.__gross = Math.round(y.gross);
    row.__spending = Math.round(y.spending);
    row.__shortfall = Math.round(y.shortfall);
    row.__total = row.__gross;
    return row;
  });

  const totalTaxes = incomeRows.reduce((t, r) => t + r.__taxes, 0);

  return { worthRows, incomeRows, depletionAge, shortfallAge, totalTaxes, rmdAge: applyRmd ? rmdAge : null };
}
