# Money Pool

Group money collection with a visible goal. Built on top of the Pollar SDK template for GrantFox Issue #7.
This application allows a group to fund a goal end-to-end on testnet: contributions are paid by QR from several Pollar accounts, funds land directly in the organizer's balance, and a live progress bar updates as payments arrive. Every movement is verifiable on-chain via its hash.

## Requirements

- Node.js and pnpm
- A Pollar Account
- A Neon Database Project (PostgreSQL)

## Local Setup

To run this application locally from a fresh clone, you only need your Pollar API key (a local SQLite database will be created automatically):

1. Clone the repository and navigate to the app directory:

   ```bash
   cd pollar-apps/apps/money-pool
   ```

2. Copy the environment variables example file:

   ```bash
   cp .env.example .env
   ```

3. Get a Pollar API key from the dashboard: [dashboard.pollar.xyz](https://dashboard.pollar.xyz) (Build → API Keys → Generate). It must be a **Publishable** key on **testnet** (`pub_testnet_...`).
4. Add your Pollar API key to the `.env` file.
5. Install dependencies and start the application:

   ```bash
   pnpm install && pnpm dev
   ```

## Production Setup (Neon Database)

If you wish to deploy the app or use a remote PostgreSQL database:

1. Create a project in [Neon Database](https://neon.tech/).
2. Add your pooled connection string to `.env` as `DATABASE_URL=postgres://...`.
3. Push the database schema to your Neon project:

   ```bash
   pnpm drizzle-kit push
   ```

## Environment Variables

Your `.env` file should look like this:

```env
# Paste your Pollar publishable key in .env — get it at dashboard.pollar.xyz under Build → API Keys → Generate (type: Publishable, while developing).
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_...

# PostgreSQL Connection String (pooled) from Neon Database
# Optional for local development (will use SQLite automatically if omitted). Required for production.
# DATABASE_URL=postgres://user:password@hostname/dbname?sslmode=require
```

| Variable | Description | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Public key for the Pollar SDK | [dashboard.pollar.xyz](https://dashboard.pollar.xyz) |
| `DATABASE_URL` | PostgreSQL Connection String (pooled). Optional locally. | <https://console.neon.tech> |

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

## Architecture & Flow Diagram

```mermaid
sequenceDiagram
    actor Organizer
    participant App as Money Pool
    participant DB as Neon DB
    participant Pollar as Pollar SDK / Wallet
    participant Stellar as Stellar Testnet / RPC

    Organizer->>App: Creates Pool (Signs with SEP-53)
    App->>Pollar: Verifies Signature
    App->>DB: Saves Pool Data
    App-->>Organizer: Returns Pool Link/QR

    actor Contributor
    Contributor->>App: Scans QR / Opens Link
    App->>DB: Lazy Sync (Closes expired pools)
    App->>DB: Fetches Pool Data
    App-->>Contributor: Shows Goal & Progress

    Contributor->>Pollar: Submits Contribution (amount, memo: poolId)
    Pollar->>Stellar: Executes On-Chain Transaction
    Stellar-->>Pollar: Returns txHash

    Contributor->>App: POST /contributions {txHash, amount}
    App->>Stellar: Parses XDR via RPC to verify (amount, asset, memo, from)
    Stellar-->>App: Verification Result
    App->>DB: Records Contribution (Marks overGoal if applicable)
    App-->>Contributor: Success! Live progress updates
```

## Security & Architecture

- **Contributions Verification**: Protected by querying the **Stellar RPC (Soroban)** directly. The backend parses the raw XDR envelopes of the `txHash` to strictly verify that: the recipient is the organizer, the asset is Testnet USDC, the exact amount matches, and the memo matches the `poolId`. The actual payer's address is extracted directly from the blockchain (not the client payload), making credit theft impossible.
- **Pool Management (SEP-53)**: Protected by **DPoP (Proof of Possession)** using Stellar SEP-53 signatures (`x-money-pool-auth`). There are no secrets stored in `localStorage` or cookies. The organizer proves ownership of their Pollar Wallet cryptographically for sensitive operations (creating or closing a pool).
- **Over-goal Contributions (Race Condition)**: Handled elegantly. If a pool reaches its goal while another contributor's payment is in-flight, the backend does not drop the valid on-chain payment. It is recorded in the database and flagged as `overGoal` for easy reconciliation without causing money loss.
- **Global State Synchronization (Lazy Sync)**: To prevent stale data in global lists, all list endpoints (such as `/api/pools` or user history) run a global synchronization to automatically close any pool that has passed its `deadline` at the exact minute it's fetched, ensuring the frontend doesn't rely on delayed CRON jobs.
- **Rate Limits**: By design for this testnet version, there is no rate-limiting on pool creation. Contributions naturally rate-limit themselves because submitting a valid payload requires spending real USDC on the testnet.

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
