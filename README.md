# Nestimate

**Size up the nest egg.**

Nestimate is a small retirement projection tool that runs entirely in your
browser. Enter your accounts, contributions, withdrawals and income streams, and
see how your net worth and annual income play out year by year. Nothing you
enter leaves your device.

**Live site:** https://nestimate.sneelco.workers.dev (Cloudflare Workers; see Deployment)

## Features

- **Investment accounts** with a starting balance, an annual growth rate, and any
  number of contribution or withdrawal schedules. Withdrawals can be a fixed
  amount or a percent of the current balance per year.
- **Income streams** such as Social Security or a pension, with an annual
  cost-of-living increase (COLA).
- **Key ages** like "Retirement" or "Social Security" that schedules can reference,
  so moving one milestone shifts everything tied to it.
- **Net worth and annual income charts** with synced tooltips, stacked by account,
  with key ages and other schedule milestones marked.
- **Spending target** with any number of spending items, each with its own start,
  end, and annual increase.
- **Automatic drawdown**: whatever after-tax income does not cover is withdrawn from
  your investment accounts in the order you list them, grossed up for tax. Each
  account can opt out or set an age before which it is off limits, such as 59.5
  for a 401(k).
- **Tax awareness**: each account is taxable, tax-deferred, or Roth; income streams
  have a taxable portion; required minimum distributions kick in at 73 or 75.
- **Summary stats**: peak net worth, net worth at the end of the projection, lifetime
  taxes, and a warning from the first age your spending is not fully covered.
- **Automatic saving** to the browser's local storage, plus a light/dark theme
  that follows your system preference and remembers your choice.
- **Optional account** for syncing the plan across devices. Sign in with email
  and password (or GitHub when enabled); the plan on this device is uploaded on
  first sign-in and kept in step afterwards. Without an account nothing leaves
  your device.
- **MCP endpoint** so Claude (or any MCP client) can read the plan, run the
  projection, and answer what-if questions. API keys are created on the account page.
- **Export and import** of the whole plan as a JSON file, and a one-click reset
  to the sample plan.
- **Installable and works offline.** Nestimate is a progressive web app: install
  it from the browser's address bar or share menu and it opens like a native app,
  with no network needed.

Projections are nominal, before tax, and illustrative only. Nestimate is not
financial advice.

## Using Nestimate

Open the [live site](https://nestimate.sneelco.workers.dev) and start from the
sample plan, or reset to it at any time from the card at the bottom of the page.

1. **Set your birthday and a projection end age.** Your current age is computed
   from the birthday and every projection starts from today.
2. **Define key ages.** Give each milestone a name and an age. Schedules can
   start or end at a key age instead of a hard-coded number, so changing
   "Retirement" from 55 to 60 shifts every contribution and withdrawal that
   references it.
3. **Add accounts.** An *Investment account* has a balance and a growth rate and
   holds contribution and withdrawal schedules. An *Income stream* has no balance;
   it pays out on a schedule and grows by its COLA each year.
4. **Add schedules.** Each schedule has an amount, a frequency (weekly, every two
   weeks, monthly, yearly), and a start and end. Start and end can be "Now" or
   "Never", a key age, or a specific age. Withdrawals can instead be a percent of
   the balance per year, recomputed from the current balance.
5. **Set your spending.** Add one or more spending items, such as living expenses
   from retirement or travel until 80, each with an annual increase. Leave
   "Cover any shortfall from accounts automatically" on to let the tool draw
   what is needed; turn it off to model withdrawals entirely by hand.
6. **Set tax rates.** Enter an effective income tax rate and capital gains rate, and
   choose a tax treatment for each investment account. Income streams have a
   taxable portion (85% by default for Social Security).
7. **Read the charts.** The top panel stacks investment balances over time. The
   bottom panel stacks after-tax income by source, with taxes as a gray band on
   top and your spending as a dashed red line. Where the line rises above the
   stack, spending is not covered. Teal dashed lines are key ages; gray dashed
   lines are other schedule boundaries. Hover either panel to see the breakdown
   at a given age in both.

### How the projection works

- The simulation steps month by month from your current age to the end age.
- Each month an investment balance grows by its annual rate compounded monthly,
  then active contributions are added and active withdrawals removed.
- A schedule is active from its start age up to but not including its end age.
- Withdrawals never take a balance below zero. If every investment balance hits
  zero while a withdrawal is still active, the depletion age is shown as a warning.
- Income streams are paid at their stated amount, increased by the COLA compounded
  annually from today.
- Spending items escalate by their own annual increase from today. Each month the
  after-tax income (income streams plus scheduled withdrawals) is compared with
  spending; with drawdown on, the gap is withdrawn from eligible investment
  accounts in list order, grossed up so the net amount covers the need. An account
  is eligible once drawdown is on for it and the projection has reached its
  "available for drawdown from" age. Anything still uncovered is recorded as a
  shortfall and drives the "Spending not covered" warning.
- Scheduled withdrawals and automatic drawdown can coexist: schedules run first and
  count toward spending, and drawdown only fills what remains. Income beyond
  spending is reported as a surplus but not reinvested.
- Taxes are flat effective rates. Tax-deferred withdrawals and the taxable share of
  income streams are taxed at the income rate. Withdrawals from taxable accounts are
  taxed at the capital gains rate on the whole withdrawal, which is conservative
  since only the gain is really taxable. Roth withdrawals are tax-free.
- Required minimum distributions apply to tax-deferred accounts from age 73, or 75 if
  you were born in 1960 or later, using the IRS Uniform Lifetime Table. Each year the
  required amount is the balance at the start of that age divided by the table
  factor; if scheduled and automatic withdrawals fall short of it, the difference is
  withdrawn anyway and counted as income.
- A schedule that references a deleted key age is treated as open-ended.

### Installing the app

Nestimate is a progressive web app (PWA). On desktop Chrome or Edge, use the
install icon in the address bar; on Android, choose "Add to Home screen"; on iOS
Safari, use Share → "Add to Home Screen". Once installed it launches in its own
window and works fully offline, since all data lives on the device. After a new
version is published, the app fetches it the next time it opens (and checks
hourly while open) and reloads itself as soon as the update is ready.

### Your data

- The plan is saved to the browser's local storage on every change and restored
  when you return. Without an account it is stored only on the device and browser
  you used, and clearing site data or switching browsers starts you back at the
  sample plan.
- With an account, the plan is also stored in your account and synced to any
  device you sign in on. The dot in the header shows the sync state. If two
  devices edit while offline, the newer copy wins and the other is kept as a
  backup you can restore from the account page.
- Use **Export** to download a JSON backup and **Import** to load it anywhere
  else. The card at the bottom of the page warns you if the browser is blocking
  local storage.
- Plans saved by the earlier GitHub Pages version (key `nestimate.plan.v1`) are
  picked up automatically the first time this version runs in that browser.

### Claude and MCP

Sign in → account menu → **Account** → **API keys** → **New key**, then point an
MCP client at `https://<host>/mcp` with `Authorization: Bearer <key>` (details in
[docs/MCP.md](docs/MCP.md)). Besides the generic `get_state` / `replace_state` /
`patch_state` tools, Nestimate exposes:

| Tool | What it does |
|---|---|
| `summarize_plan` | The plan in prose-friendly form: ages, accounts, schedules, spending, taxes, milestones |
| `run_projection` | Runs the same engine as the charts and returns peak/final net worth, depletion and shortfall ages, lifetime taxes, and per-year rows. Pass a `plan` to answer what-if questions without saving |

## Plan file format

Export produces a JSON document like this:

```json
{
  "format": "nestimate-plan",
  "version": 1,
  "exportedAt": "2026-09-04T12:00:00.000Z",
  "plan": {
    "birthday": "1985-06-15",
    "endAge": 95,
    "keyAges": [{ "id": "k1", "name": "Retirement", "age": 55 }],
    "accounts": [
      {
        "id": "a1", "name": "401(k)", "type": "balance", "taxType": "deferred", "drawdown": true,
        "balance": 250000, "growth": 7,
        "schedules": [
          { "id": "s1", "kind": "contribution", "amount": 1200, "amountType": "fixed",
            "freq": "monthly", "startAge": "", "endAge": "@k1" }
        ]
      },
      {
        "id": "a2", "name": "Social Security", "type": "income", "cola": 2, "taxablePct": 85,
        "schedules": [
          { "id": "s2", "kind": "payment", "amount": 2800, "amountType": "fixed",
            "freq": "monthly", "startAge": 67, "endAge": "" }
        ]
      }
    ],
    "spending": [
      { "id": "sp1", "name": "Living expenses", "amount": 6000, "freq": "monthly",
        "increase": 2.5, "startAge": "@k1", "endAge": "" }
    ],
    "tax": { "incomeRate": 22, "gainsRate": 15, "rmd": true },
    "drawdown": { "enabled": true }
  }
}
```

| Field | Values |
| --- | --- |
| `account.type` | `balance` (investment) or `income` (income stream) |
| `account.taxType` | `taxable`, `deferred`, or `roth` (investment accounts; guessed from the name if missing) |
| `account.drawdown` | `true` / `false`: whether automatic drawdown may use this account |
| `account.drawdownFrom` | age before which drawdown will not touch the account: `""`, a number, or `"@<keyAgeId>"` |
| `account.taxablePct` | 0–100: share of an income stream that is taxed |
| `spending[].increase` | annual escalation of that spending item in percent |
| `tax` | `incomeRate` and `gainsRate` in percent, `rmd` on/off |
| `drawdown.enabled` | whether shortfalls are drawn from accounts automatically |
| `schedule.kind` | `contribution` or `withdrawal` on a balance account; `payment` on an income stream |
| `schedule.amountType` | `fixed`, or `percent` for a withdrawal that is a percent of balance per year |
| `schedule.freq` | `weekly`, `biweekly`, `monthly`, `yearly` |
| `startAge` / `endAge` | `""` (now / never), a number, or `"@<keyAgeId>"` to reference a key age |

Import accepts either this wrapped document or a bare `plan` object. Missing or
malformed fields fall back to safe defaults, so plans exported before spending and
tax support still load; only a document with no `accounts` list, invalid JSON, or a
newer format version is rejected.

## Development

Nestimate is built on [Outpost](https://github.com/sneelco/outpost): one
Cloudflare Worker serving the React PWA, a Hono API, Better Auth on D1, per-user
state in KV synced with localStorage, and the MCP endpoint. Requires Node 22+
and pnpm.

```sh
pnpm install
cp .dev.vars.example .dev.vars     # set BETTER_AUTH_SECRET
pnpm db:migrate:local              # create the local auth tables (once)
pnpm dev                           # http://localhost:5173 (client HMR + Worker in workerd)
pnpm test                          # engine, storage and schema unit tests + Worker tests in Miniflare
pnpm typecheck && pnpm lint
pnpm build                         # dist/client (assets) + dist/nestimate (Worker)
pnpm preview                       # serve the production build locally
```

### Project layout

```
index.html                              Vite entry page
wrangler.jsonc                          Worker config (KV + D1 ids)
src/shared/app.ts                       App identity (id, name, colors)
src/shared/state.ts                     State schema: { plan }, validated via normalizePlan + Zod
src/shared/nestimate/plan.js            Plan model, defaults, key ages, frequencies, milestones
src/shared/nestimate/simulate.js        Month-by-month projection engine
src/shared/nestimate/storage.js         Plan normalization, legacy localStorage, import/export
src/shared/nestimate/format.js          Number formatting and helpers
src/shared/nestimate/*.test.js          Unit tests for the engine and storage
src/client/features/nestimate/          The UI: NestimateFeature.jsx, theme, components/
src/client/                             Outpost shell: store, sync engine, auth UI, account page
src/server/                             Outpost Worker: Hono app, auth, KV state API, MCP
src/server/mcp/tools.app.ts             summarize_plan and run_projection MCP tools
migrations/                             D1 migrations (Better Auth tables)
.github/workflows/ci.yml                Checks + preview deploy on pull requests
.github/workflows/deploy.yml            Migrate + deploy + smoke check on push to main
```

The projection engine and storage layer are plain JavaScript with no React
dependency, so they can be tested and reused on their own — the Worker imports
`simulate.js` directly for the `run_projection` MCP tool. The UI is React with
inline styles and [Recharts](https://recharts.org) for the charts.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: install, typecheck,
lint, test, build, apply D1 migrations, `wrangler deploy`, then check
`/api/health` reports the deployed commit. Pull requests get a preview URL from
`.github/workflows/ci.yml` (previews share the production KV and D1).

First-time setup (create the KV namespace and D1 database, paste their ids into
`wrangler.jsonc`, set the `BETTER_AUTH_*` secrets, add the Cloudflare token and
account id to the repo secrets) is described step by step in the
[Outpost README](https://github.com/sneelco/outpost#first-time-setup). Roll back
with `pnpm exec wrangler rollback` or by reverting the commit.

## License

Nestimate is released under the [MIT License](LICENSE).
