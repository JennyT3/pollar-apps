# pollar-apps

Build payment apps with the [Pollar SDK](https://docs.pollar.xyz). Each app in the table below is an open issue on [GrantFox](https://www.grantfox.xyz/): you apply, get assigned, build it on top of our template, and ship it via PR.

## 1. Apply for an app

1. Sign in with your **GitHub account** on the [GrantFox contributor platform](https://contribute.grantfox.xyz/)
2. Find this project and open the issue of the app you want to build (one issue per app, see the table below)
3. Submit a short application explaining how you'd tackle it
4. Wait until the maintainers **assign the issue to you**. Don't start building before that: the issue might go to someone else

More about how GrantFox works: [docs.grantfox.xyz](https://docs.grantfox.xyz/)

## 2. Build it

Once assigned, fork this repo and clone your fork:

```bash
git clone https://github.com/<your-user>/pollar-apps
cd pollar-apps
```

Copy the template into your app's folder (the exact slug is in your issue):

```bash
cp -r template apps/<slug>
cd apps/<slug>
```

Set up your Pollar API key and run it:

```bash
cp .env.example .env
# paste your publishable key from dashboard.pollar.xyz (Build → API Keys)
pnpm install
pnpm dev
```

The template already ships auth, balance, payments and a UI kit. Read `apps/<slug>/README.md` for what's included and how to build on it. When your app is ready, deploy it to Vercel and put the production URL in your `pollar.manifest.json`.

## 3. Send your PR

1. Create a branch in your fork and commit your work
2. Open a PR against this repo's `main`, linking the issue you were assigned
3. Maintainers review it through GrantFox; once merged, your contribution is verified and recorded on your profile

**PR rules:**

- Touch only `apps/<your-slug>/` and your entry in `apps.json`. Any change outside of that gets the PR rejected
- Fill `pollar.manifest.json` completely (name, description, icon, deploy URL)
- Your app must run from a fresh clone with `pnpm install && pnpm dev` and nothing more than your API key in `.env`
- Use Pollar login and real payments, not mocks

## The apps

| Slug | Category | What it is |
|------|----------|------------|
| `pasanaku-circles` | savings | Digital pasanaku: rotating savings groups with turns and tracked payments |
| `bill-split` | savings | Split a bill between friends |
| `money-pool` | savings | Group money collection with a visible goal |
| `alcancia-goals` | savings | Digital alcancía: set a savings goal (solo or family) and watch it grow |
| `vendor-pay-link` | commerce | Payment link/QR generator for informal street vendors, no store or website needed |
| `qr-menu-orders` | commerce | Digital menu with QR ordering and payment for restaurants and food stalls |
| `raffle-hub` | commerce | Raffles with paid tickets and verifiable draw |
| `fiado-ledger` | commerce | Digital "cuaderno de fiado" for neighborhood stores: track credit, customers settle from their wallet |
| `event-tickets` | community | Ticket pre-sale for small events (parties, university events, local shows) |
| `match-predictions` | community | Football match predictions between friends, everyone chips into the pot, most accurate wins |
| `market-orders` | community | Pre-order and pay ahead to market vendors, pick up without waiting in line |
| `chamba-receipts` | community | Digital receipts for informal workers: every payment received builds a verifiable income history |
