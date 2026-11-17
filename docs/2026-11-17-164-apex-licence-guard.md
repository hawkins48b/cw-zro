# ApexCharts updates checked by licence, not by version number

Issue: [#164](https://github.com/hawkins48b/cw-zro/issues/164). Date: 2026-11-17.

## Why

Dependabot opened #163 (apexcharts 8.8.1 → 8.8.2, apex-commons 0.10.0 → 0.11.0) and its CI run failed: `src/test/apexcharts.test.js` expected the literal version `8.8.1`. Every ApexCharts update, patch included, would have failed the same way, although `.github/dependabot.yml` and the README already say each update gets its own pull request and a licence review. The owner decision on #75 was an exact pin with the current licence terms accepted, not a freeze on 8.8.1.

## What changed

| File | Change |
|------|--------|
| `src/test/apexcharts.test.js` | The version test now checks that `package.json` pins `apexcharts` exactly (`x.y.z`, no `^` or `~`) and that the installed version matches it. Two new tests compare the sha256 of `node_modules/apexcharts/LICENSE.md` and `node_modules/apex-commons/LICENSE.md` with the accepted text (`ACCEPTED_LICENCES`), and check that each `package.json` still says `SEE LICENSE IN LICENSE.md`. A fourth checks there is no second, unchecked apex-commons under `node_modules/apexcharts/node_modules`. 9 tests become 12 |
| `.github/dependabot.yml` | Comments only: the apexcharts and apex-commons exclusions point to the licence test. Behaviour unchanged |
| `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/testing.md` | Describe the same rule: green PR → release notes and charts in a browser, then merge; red licence test → stop for the owner, change the hash only after they accept |

## Checks

- The `LICENSE.md` of apexcharts 8.8.2 is byte-identical to 8.8.1, and apex-commons 0.11.0 to 0.10.0 (compared from the npm tarballs).
- With 8.8.2 installed (`npm i apexcharts@8.8.2 --save-exact`, then reverted), all 12 tests pass.
- A caret range (`^8.8.1`) fails the pin test; one line appended to the installed `LICENSE.md` fails the licence test.

## Security review

PASS. Its three low findings were fixed in the branch: the `license` field check, the nested apex-commons check, and the README wording now holds.

## Left open

- #163 still needs its review before merging: release notes, and the charts checked in a browser. Dependabot rebases it on `develop`, which re-runs CI.
- Dependabot *security updates* must stay off in the repository settings (README); the token cannot read that setting.
