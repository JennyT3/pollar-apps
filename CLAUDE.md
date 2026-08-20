# pollar-apps

Monorepo where devs build payment apps with the Pollar SDK. Each dev applies to an issue on GrantFox, gets assigned a slug, copies the template to `apps/<slug>/`, builds their app, and submits it as a PR that closes the issue.

## Structure

- `template/`: Next.js 16 + Tailwind 4 + pnpm base that devs copy. **Never modified.**
- `apps/`: each app lives in its own `apps/<slug>/` folder, delivered via PR.
- `apps.json`: registry of the 12 apps (slug, category, issue, deploy, author).

## Critical scope rule

Work **only** inside the dev's `apps/<slug>/` and their corresponding entry in `apps.json`. Never modify:

- `template/`
- other apps' folders in `apps/`
- repo root files (README.md, this file, etc.)

A PR touching anything outside that scope gets rejected.

## Each app is an island

- Each app has its own `package.json` and its own lockfile.
- No pnpm workspaces, no dependencies between apps.
- The app must run with `pnpm install && pnpm dev` from its folder, with no setup other than the Pollar API key in `.env`.

## The template already ships with Pollar integrated

Auth, balance, and payments are already wired up in the template. Build your app **on top** of that integration; don't rewrite or "improve" the Pollar layer.
