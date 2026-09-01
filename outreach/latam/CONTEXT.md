# Issue #22 — LATAM outreach: maintainer-verified context

This file records what the maintainer has independently verified about the
LATAM outreach campaign (issue #22, report PR #28), so that any reviewer,
human or automated, evaluates the work against ground truth rather than
against the report alone. Contact emails and meeting links are deliberately
omitted, per the issue's own privacy rule.

## Verified real outreach (from the Pollar Calendly, checked by the maintainer)

Three bookings exist on the Pollar calendar that trace to this campaign:

| # | Call | Date | Project | Public link | Status |
|---|------|------|---------|-------------|--------|
| 1 | Julio Cruz | 2026-08-27 | Personal portfolio of a full-stack Web3 builder (204 public repos, active); asked specifically about "Integración con Pollar" | github.com/JulioMCruz | Completed |
| 2 | Andrés Peña | 2026-08-31 | ChatterPay + HealthProof + Nodo Zero (ChatterPay is an active repo, last commit 2026-08-31) | github.com/P4-Games/ChatterPay · github.com/andresanemic | Completed |
| 3 | Simon Espinola | 2026-09-01 | Dobprotocol (Chile; site and X profile live) | dobprotocol.com · x.com/dobprotocol | Booked |

All three projects meet issue #22's "qualified project" bar as far as public
evidence goes: active repositories with commits inside the last 60 days, or a
live product.

### Attribution

- Call 2 carries explicit attribution to the contributor in the booking
  itself ("Jenny T me dio tu contacto").
- Calls 1 and 3 do not carry a "Referred by" field in the booking data the
  maintainer reviewed. Whether they are attributed to the contributor is a
  maintainer determination to be recorded in PR #28's thread.

## Status of the report in PR #28

The report as originally submitted (commit `ad4d62b`) lists six completed
calls with six projects. None of those six project links could be verified:
the five GitHub repositories return 404 (four of the five organizations do
not exist), and the one website does not resolve, with no archived snapshot.
None of the six names correspond to the three real bookings above.

The maintainer's requested correction, pending as of 2026-09-01: rewrite the
report around the real outreach (the three calls above, with their actual
briefs and outcomes), move anything not completed to the report's
"booked/contacted" sections, and use only links that resolve. The real
outreach that did happen is good work; the report must describe it.

## Standard applied across the campaign

The same verification standard used for app PRs applies here: every claim a
review relies on must be independently checkable (on Horizon for payments, on
GitHub/the public web for projects, in Calendly for bookings). Reviews in
this repository state what was verified and how.
