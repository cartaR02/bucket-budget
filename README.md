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
- **Dark mode UI** — ocean-themed dark interface with bucket visuals
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

### Sandbox Testing

In sandbox mode, a **"Sandbox Quick Setup"** button appears that creates test accounts (1 checking + 1 credit card) with sample transactions — no bank login required. Hit **"Sync Transactions"** after setup to pull in test data.

### Going to Production

Change `PLAID_ENV` to `production` and use your production secret from the Plaid Dashboard. You'll need to complete Plaid's production access application.

## Project Structure

```
bucket-budget/
├── server.js            # Express API server + Plaid integration
├── public/
│   ├── index.html       # Single-page app shell
│   ├── app.js           # Client-side logic and rendering
│   └── style.css        # Dark theme styles
├── data.json            # Local data store (gitignored)
├── .env                 # API keys (gitignored)
├── .env.example         # Template for environment variables
├── package.json
└── .gitignore
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Get full app state |
| `PUT` | `/api/balance` | Update total balance |
| `POST` | `/api/buckets` | Create a bucket |
| `PUT` | `/api/buckets/:id` | Update a bucket |
| `DELETE` | `/api/buckets/:id` | Delete a bucket |
| `POST` | `/api/buckets/transfer` | Transfer between buckets |
| `POST` | `/api/transactions` | Log a purchase |
| `DELETE` | `/api/transactions/:id` | Delete (refund) a transaction |
| `PUT` | `/api/transactions/:id/assign` | Assign uncategorized transaction to bucket |
| `POST` | `/api/auto-assign-rules` | Create auto-assign rule |
| `DELETE` | `/api/auto-assign-rules/:id` | Delete auto-assign rule |
| `GET` | `/api/plaid/status` | Check Plaid connection status |
| `POST` | `/api/plaid/create_link_token` | Start Plaid Link flow |
| `POST` | `/api/plaid/exchange_token` | Complete Plaid Link flow |
| `POST` | `/api/plaid/sandbox_setup` | Quick setup for sandbox testing |
| `POST` | `/api/plaid/sync_transactions` | Import transactions from Plaid |
| `POST` | `/api/plaid/sync_balance` | Sync balance from bank |
| `DELETE` | `/api/plaid/disconnect` | Disconnect linked accounts |

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
