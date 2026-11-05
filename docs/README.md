# Delivery documentation

- [2026-11-05: Max apex independent of the table step](2026-11-05-85-max-apex.md): max apex is now the same at any step and stays within the range; pinned values unchanged
- [2026-11-05: Humidity of 1 % or less](2026-11-05-84-humidity-fraction.md): 1 % no longer gives the result of 100 %; saved values of 1 or less shift, values above 1 are unchanged
- [2026-11-05: Trajectory validation above the line of sight, and failure reporting](2026-11-05-82-83-validation-solver.md): Below / Above choice on the page; unreachable goals now give "No solution" instead of a value
- [2026-11-04: Powder sensitivity in fps per degree](2026-11-04-81-powder-sensitivity.md): the setting now gives the entered fps per degree at any velocity; results of saved profiles shift
- [2026-11-04: Ballistics reference tests](2026-11-04-70-ballistics-reference-tests.md): regression baseline and published-data checks before the js-ballistics upgrade; lists open calculation problems
- [2026-11-04: Working production deploy and CI](2026-11-04-66-68-ci-deploy.md): Node 22 fix, CI before every deploy, FTPS, and open owner actions
