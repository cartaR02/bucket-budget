# Bucket Budget

A personal finance app that uses a visual "bucket" system to manage your budget. Allocate money into spending categories, track transactions, and sync credit card purchases automatically via Plaid.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Plaid](https://img.shields.io/badge/Plaid-Transactions-0A85EA?logo=data:image/svg+xml;base64,&logoColor=white)

## Features

- **Visual bucket system** — drag-and-drop style budget categories with animated water-fill indicators
- **Transaction tracking** — log purchases manually or sync from your bank
- **Plaid integration** — connect bank accounts and credit cards to auto-import transactions
- **Auto-assign rules** — set up vendor patterns (e.g. "starbucks") to automatically categorize imports
- **Transfer funds** — move money between buckets or back to unallocated
- **Multiple pools** — separate spending, percentage-based savings, and goal-savings pools
- **Optional password lock** — keep your budget private when the server is reachable from the internet
- **Mobile responsive** — works on phone, tablet, and desktop

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/cartaR02/bucket-budget.git
cd bucket-budget
npm install
```

### Running the App

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

That's it — the app works fully without Plaid. You can manually set your balance, create buckets, and log transactions.

## Plaid Setup (Optional)

To connect real bank accounts or credit cards for automatic transaction syncing:

1. Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Copy your API keys from **Developers > Keys**
3. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

4. Fill in your credentials:

```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox
```

5. Restart the server — a **"Link Account"** button will appear in the app
6. After linking, choose which pool each account feeds (the app opens the pool editor for you). Accounts that feed no pool are not imported; attaching one later backfills its history on the next sync.

If a bank connection expires, that bank shows a **Reconnect** button; other banks keep syncing in the meantime.

### Sandbox Testing

In sandbox mode, a **"Sandbox Quick Setup"** button appears that creates test accounts (1 checking + 1 credit card) with sample transactions — no bank login required. Attach the accounts to a pool, then hit **"Sync Transactions"** to pull in test data.

### Going to Production

Change `PLAID_ENV` to `production` and use your production secret from the Plaid Dashboard. You'll need to complete Plaid's production access application. (Plaid retired its `development` environment; the server treats it as `production` and logs a warning.)

## Password Protection

The app has no accounts — by default anyone who can reach the server can see and change your budget. Set `APP_PASSWORD` to require a password first:

```
APP_PASSWORD=choose-something-long
```

On Fly.io: `fly secrets set APP_PASSWORD=choose-something-long`. Logging in sets a long-lived, HttpOnly session cookie; changing the password signs every device out.

## Project Structure

```
bucket-budget/
├── server.js            # Express API server + Plaid integration
├── public/
│   ├── index.html       # Single-page app shell
│   ├── app.js           # Client-side logic and rendering
│   └── style.css        # Styles
├── data.json            # Local data store (gitignored)
├── .env                 # API keys (gitignored)
├── .env.example         # Template for environment variables
├── package.json
└── .gitignore
```

## API Endpoints

Pool-scoped routes live under `/api/pools/:poolId`. Mutating routes return the full app state (Plaid access tokens are never included).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Get full app state |
| `GET` | `/api/session` | Whether a password is required / the caller is signed in |
| `POST` | `/api/login`, `/api/logout` | Sign in / out (only when `APP_PASSWORD` is set) |
| `POST` | `/api/pools` | Create a pool |
| `PUT` | `/api/pools/:poolId` | Rename a pool / change its linked and balance accounts |
| `DELETE` | `/api/pools/:poolId` | Delete a pool (not the last one) |
| `PUT` | `/api/pools/:poolId/active` | Switch the active pool |
| `PUT` | `/api/pools/:poolId/balance` | Update the pool balance |
| `POST` | `/api/pools/:poolId/deposit` | Log a paycheck deposit (savings pools) |
| `POST` | `/api/pools/:poolId/buckets` | Create a bucket |
| `PUT` | `/api/pools/:poolId/buckets/:id` | Update a bucket |
| `DELETE` | `/api/pools/:poolId/buckets/:id` | Delete a bucket (and rules pointing at it) |
| `POST` | `/api/pools/:poolId/buckets/transfer` | Move money between buckets / unallocated |
| `POST` | `/api/pools/:poolId/transactions` | Log a purchase or withdrawal |
| `DELETE` | `/api/pools/:poolId/transactions/:id` | Delete a transaction and reverse all of its effects |
| `PUT` | `/api/pools/:poolId/transactions/:id/assign` | Assign or move a transaction to a bucket |
| `POST` | `/api/pools/:poolId/transactions/:id/mark-income-split` | Tag a transaction as income, split across tax buckets |
| `POST` | `/api/pools/:poolId/transactions/:id/mark-transfer-in` | Fill a goal-savings pool's tax buckets from a transaction |
| `DELETE` | `/api/pools/:poolId/transactions/:id/transfer-in` | Undo a transfer-in |
| `POST` | `/api/pools/:poolId/auto-assign-rules` | Create a rule (`applyToExisting` also sorts uncategorized transactions) |
| `DELETE` | `/api/pools/:poolId/auto-assign-rules/:id` | Delete a rule |
| `GET` | `/api/plaid/status` | Plaid configuration and per-bank connection status |
| `POST` | `/api/plaid/create_link_token` | Start Plaid Link (pass `itemId` to reconnect a bank) |
| `POST` | `/api/plaid/exchange_token` | Complete Plaid Link |
| `POST` | `/api/plaid/items/:itemId/reconnected` | Confirm a reconnected bank works again |
| `POST` | `/api/plaid/sandbox_setup` | Quick setup for sandbox testing |
| `POST` | `/api/plaid/sync_transactions` | Import transactions from every linked bank |
| `POST` | `/api/plaid/sync_balance` | Update pool balances from bank balances (credit cards count as debt) |
| `POST` | `/api/plaid/reset_cursor` | Re-import a bank's transaction history |
| `DELETE` | `/api/plaid/disconnect` | Disconnect one bank (`?itemId=`) or all |

## How It Works

1. **Set your balance** — enter your total bank balance
2. **Create buckets** — set up spending categories (Dining, Clothes, Essentials, etc.) with target amounts
3. **Allocate funds** — distribute your balance across buckets
4. **Track spending** — log purchases manually or sync from Plaid; each purchase deducts from the bucket and balance
5. **Auto-categorize** — create rules like "starbucks" -> "Dining Out" so imported transactions sort themselves

## Tech Stack

- **Backend:** Node.js, Express 5
- **Frontend:** Vanilla JS, CSS (no frameworks)
- **Banking:** Plaid API (transactions sync)
- **Storage:** JSON file (no database needed)

## License

MIT
