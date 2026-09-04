# Nestimate

**Size up the nest egg.**

Nestimate is a small retirement projection tool that runs entirely in your
browser. Enter your accounts, contributions, withdrawals and income streams, and
see how your net worth and annual income play out year by year. Nothing you
enter leaves your device.

**Live site:** https://sneelco.github.io/nestimate/

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
- **Summary stats**: peak net worth, net worth at the end of the projection, and a
  warning if investment balances run out while you are still withdrawing.
- **Automatic saving** to the browser's local storage, plus a light/dark theme
  that follows your system preference and remembers your choice.
- **Export and import** of the whole plan as a JSON file, and a one-click reset
  to the sample plan.

Projections are nominal, before tax, and illustrative only. Nestimate is not
financial advice.

## Using Nestimate

Open the [live site](https://sneelco.github.io/nestimate/) and start from the
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
5. **Read the charts.** *Net worth* stacks investment balances over time. *Annual
   income* stacks withdrawals and income-stream payments by source. Teal dashed
   lines are key ages; gray dashed lines are other schedule boundaries. Hover
   either chart to see the breakdown at a given age in both.

### How the projection works

- The simulation steps month by month from your current age to the end age.
- Each month an investment balance grows by its annual rate compounded monthly,
  then active contributions are added and active withdrawals removed.
- A schedule is active from its start age up to but not including its end age.
- Withdrawals never take a balance below zero. If every investment balance hits
  zero while a withdrawal is still active, the depletion age is shown as a warning.
- Income streams are paid at their stated amount, increased by the COLA compounded
  annually from today.
- A schedule that references a deleted key age is treated as open-ended.

### Your data

- The plan is saved to the browser's local storage on every change and restored
  when you return. It is stored only on the device and browser you used.
- Clearing site data, using a private window, or switching browsers or devices
  starts you back at the sample plan.
- Use **Export** to download a JSON backup and **Import** to load it anywhere
  else. The card at the bottom of the page warns you if the browser is blocking
  local storage.

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
        "id": "a1", "name": "401(k)", "type": "balance", "balance": 250000, "growth": 7,
        "schedules": [
          { "id": "s1", "kind": "contribution", "amount": 1200, "amountType": "fixed",
            "freq": "monthly", "startAge": "", "endAge": "@k1" }
        ]
      },
      {
        "id": "a2", "name": "Social Security", "type": "income", "cola": 2,
        "schedules": [
          { "id": "s2", "kind": "payment", "amount": 2800, "amountType": "fixed",
            "freq": "monthly", "startAge": 67, "endAge": "" }
        ]
      }
    ]
  }
}
```

| Field | Values |
| --- | --- |
| `account.type` | `balance` (investment) or `income` (income stream) |
| `schedule.kind` | `contribution` or `withdrawal` on a balance account; `payment` on an income stream |
| `schedule.amountType` | `fixed`, or `percent` for a withdrawal that is a percent of balance per year |
| `schedule.freq` | `weekly`, `biweekly`, `monthly`, `yearly` |
| `startAge` / `endAge` | `""` (now / never), a number, or `"@<keyAgeId>"` to reference a key age |

Import accepts either this wrapped document or a bare `plan` object. Missing or
malformed fields fall back to safe defaults; only a document with no `accounts`
list, invalid JSON, or a newer format version is rejected.

## Development

Requires Node.js 22 or later.

```sh
npm install
npm run dev        # start the dev server at http://localhost:5173
npm test           # run unit tests (vitest)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

To preview the build exactly as it is served on GitHub Pages, set the base path:

```sh
BASE_PATH=/nestimate/ npm run build
BASE_PATH=/nestimate/ npm run preview   # then open http://localhost:4173/nestimate/
```

### Project layout

```
index.html                  Vite entry page
src/main.jsx                React bootstrap
src/App.jsx                 App shell: state, persistence, charts, layout
src/theme.js                Light/dark palettes and theme context
src/styles.css              Global resets
src/lib/plan.js             Plan model, defaults, key ages, frequencies, milestones
src/lib/simulate.js         Month-by-month projection engine
src/lib/storage.js          Plan validation, localStorage, import/export
src/lib/format.js           Number formatting and helpers
src/lib/*.test.js           Unit tests for the engine and storage
src/components/             UI: account and schedule editors, key ages, charts, data card
.github/workflows/ci.yml    Tests and build on pull requests and branches
.github/workflows/deploy.yml  Build and publish to GitHub Pages on push to main
```

The projection engine and storage layer are plain JavaScript with no React
dependency, so they can be tested and reused on their own. The UI is React with
inline styles and [Recharts](https://recharts.org) for the charts.

## Deployment

The app is published to GitHub Pages at:

**https://sneelco.github.io/nestimate/**

Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. installs dependencies and runs the tests,
2. builds the site with `BASE_PATH=/nestimate/` so asset URLs resolve under the
   project sub-path,
3. uploads `dist/` as a Pages artifact and deploys it.

The workflow calls `actions/configure-pages` with `enablement: true`, so Pages
should turn on automatically the first time it runs. If the deploy job fails with
a permissions error, open the repository's **Settings → Pages** and set
**Source** to **GitHub Actions**, then re-run the workflow.

The base path is derived from the repository name, so a fork named differently
will deploy to `https://<owner>.github.io/<repo>/` without any changes. The
workflow can also be started by hand from the Actions tab.

Pull requests and non-`main` branches run `.github/workflows/ci.yml`, which runs
the tests and a build but does not deploy.

## License

Nestimate is released under the [MIT License](LICENSE).
