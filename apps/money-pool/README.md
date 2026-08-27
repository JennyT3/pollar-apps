# Money Pool

Group money collection with a visible goal. Built on top of the Pollar SDK template for GrantFox Issue #7.
This application allows a group to fund a goal end-to-end on testnet: contributions are paid by QR from several Pollar accounts, funds land directly in the organizer's balance, and a live progress bar updates as payments arrive. Every movement is verifiable on-chain via its hash.

## Requirements

- Node.js and pnpm
- A Pollar Account
- A Neon Database Project (PostgreSQL)

## Step-by-step Setup

To run this application from a fresh clone:

1. Clone the repository and navigate to the app directory:

   ```bash
   cd pollar-apps/apps/money-pool
   ```

2. Copy the environment variables example file:

   ```bash
   cp .env.example .env
   ```

3. Create a project in [Neon Database](https://neon.tech/) and copy your pooled connection string.
4. Get a Pollar API key from the dashboard: [dashboard.pollar.xyz](https://dashboard.pollar.xyz) (Build → API Keys → Generate). It must be a **Publishable** key on **testnet** (`pub_testnet_...`).
5. Fill the `.env` file with both variables (see the Environment Variables section below).
6. Install dependencies:

   ```bash
   pnpm install
   ```

7. Push the database schema to your Neon project:

   ```bash
   pnpm db:push
   ```

8. Start the development server:

   ```bash
   pnpm dev
   ```

## Environment Variables

Your `.env` file should look like this:

```env
# Paste your Pollar publishable key in .env — get it at dashboard.pollar.xyz under Build → API Keys → Generate (type: Publishable, while developing).
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_...

# PostgreSQL Connection String (pooled) from Neon Database
DATABASE_URL=postgres://user:password@hostname/dbname?sslmode=require
```

| Variable | Description | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Public key for the Pollar SDK | [dashboard.pollar.xyz](https://dashboard.pollar.xyz) |
| `DATABASE_URL` | PostgreSQL Connection String (pooled) | <https://console.neon.tech> |

## How to Create a Pool

1. Log in to the application using your Pollar account.
2. On the home page, tap "Crear un pool" (Create a pool).
3. Fill in the required details: Name, Description, Goal Amount (in USDC), and an optional Deadline.
4. Confirm creation. You will be redirected to your newly created pool's public page.

## How to Share a Pool

On the pool's public page, you will find a "Compartir" (Share) section:

- **Share QR Code**: Scanning this QR code from any phone opens the read-only view of the pool.
- **Share Button**: Uses the native Web Share API to easily send the pool link via WhatsApp, Telegram, or copy it to the clipboard.

## How to Contribute

1. From the pool's public page, anyone can scan the **Contribution QR** or click the "Contribuir a este Pool" button.
2. This opens the contribution flow (`/pool/[id]/contribute`), prompting the user to log in if they haven't already.
3. The user inputs their desired contribution amount (in testnet USDC).
4. Upon confirmation, a real transaction is processed on the Stellar testnet directly to the organizer's Pollar account.
5. The transaction hash is verified server-side, recorded in the database, and the pool's live progress bar updates instantly.

## How the QR Flow Works

- The pool's QR is **NOT a SEP-7 QR code**. Pollar currently does not natively expose a QR with a prefilled amount.
- Instead, it operates as a deep-link to the app itself: `https://<deploy>/pool/{poolId}/contribute?amount={suggestedAmount}`
- When opened, the app resolves the organizer's Pollar address and the pool's metadata *server-side*.
- The user **never** sees or has to manually type a raw `G...` Stellar address. This keeps the flow clean and user-friendly, complying perfectly with the "prefilled, one confirmation away" requirement without depending on missing SDK features.

## Initial Spike (Payment Validation)

Before building the full app, a spike was conducted to validate the end-to-end payment flow using the Pollar SDK's `runTx` function on the Stellar testnet.

**Spike Details:**

- **Organizer Account:** `GDF5YAFNPG3I7YSPLOSCP5WZINDYZFBWDS35KCJNPXX5D4SCNTG67ZM4`
- **Contributor Account:** `GBZ4IOM7E77V75I2GTSEBZE76QZHKF52JPODNWOJI47L6UTEAN7ID4NM`
- **Transaction Hash:** [`7ea96e119af89b8bf336471bcb973ddcacd9eea6b29c2e6b9320c8755757ecbe`](https://stellar.expert/explorer/testnet/tx/7ea96e119af89b8bf336471bcb973ddcacd9eea6b29c2e6b9320c8755757ecbe)

This spike confirmed that a payment could be successfully executed with a specific memo, ensuring the core functionality of the Money Pool was viable.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Pollar SDK (`@pollar/core`, `@pollar/react`)
- Neon Database (PostgreSQL)
- drizzle-orm
