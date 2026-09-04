import { num } from "./format.js";
import { resolveAge, perMonthOf } from "./plan.js";

/**
 * Month-by-month projection of every account from startAge to endAge.
 * Returns yearly net-worth rows, yearly income rows, and the age at which
 * all investment balances hit zero while a withdrawal was still active.
 */
export function simulate(accounts, keyMap, startAge, endAge) {
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
