# Nestimate

Size up the nest egg. Nestimate is a small retirement projection tool that runs
entirely in your browser: enter your accounts, contributions, withdrawals and
income streams, and see how your net worth and annual income play out over time.

Nothing you enter leaves your device. Your plan is saved in the browser's local
storage and can be exported to a JSON file for backup or to move between devices.

## Features

- **Investment accounts** with a starting balance, growth rate, and any number of
  contribution or withdrawal schedules (fixed amounts or a percent of balance per year).
- **Income streams** such as Social Security or a pension, with an annual cost-of-living increase.
- **Key ages** ("Retirement", "Social Security", ...) that schedules can reference, so
  moving one milestone shifts everything tied to it.
- **Net worth and annual income charts** with synced tooltips and milestone markers.
- **Automatic saving** to the browser's local storage, plus a light/dark theme that is remembered.
- **Export / import** of the whole plan as a JSON file, and a one-click reset to the sample plan.

Projections are nominal, before tax, and illustrative only.

## Development

```sh
npm install
npm run dev        # start the dev server
npm test           # run unit tests (vitest)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

The app is a [Vite](https://vite.dev) + React project. The projection engine and
storage layer live in `src/lib/` and are plain JavaScript with unit tests; the UI
lives in `src/components/` and `src/App.jsx`.

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

Schedule `startAge` and `endAge` are `""` (now / never), a number, or `"@<keyAgeId>"`
to reference a key age. Import accepts either this wrapped document or a bare `plan`
object, and tolerates missing or malformed fields by falling back to safe defaults.

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow enables Pages on first run; if the
deploy step fails with a permissions error, open the repository's
**Settings → Pages** and set **Source** to **GitHub Actions**.

Pull requests and other branches run the tests and a build via `.github/workflows/ci.yml`.
