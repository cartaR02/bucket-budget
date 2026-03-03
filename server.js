require('dotenv').config();
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const DEFAULT_DATA = { balance: 0, buckets: [], transactions: [], autoAssignRules: [] };

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Plaid (optional) ---

let plaidClient = null;

if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
  const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });
  plaidClient = new PlaidApi(configuration);
  console.log(`Plaid configured (env: ${process.env.PLAID_ENV || 'sandbox'})`);
} else {
  console.log('Plaid not configured — manual balance mode only');
}

function requirePlaid(req, res, next) {
  if (!plaidClient) {
    return res.status(501).json({ error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env' });
  }
  next();
}

// --- Helpers ---

async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    // Backfill for existing data files
    if (!data.transactions) data.transactions = [];
    if (!data.autoAssignRules) data.autoAssignRules = [];
    if (data.plaid) {
      if (!data.plaid.transactionsCursor) data.plaid.transactionsCursor = '';
      if (!data.plaid.syncedPlaidTxnIds) data.plaid.syncedPlaidTxnIds = [];
    }
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeData(DEFAULT_DATA);
      return { ...DEFAULT_DATA };
    }
    throw err;
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

function getTotalAllocated(buckets) {
  return buckets.reduce((sum, b) => sum + b.allocatedAmount, 0);
}

function findAutoAssignRule(rules, vendorName) {
  const vendorLower = (vendorName || '').trim().toLowerCase();
  if (!vendorLower) return null;
  return rules.find(r => vendorLower.includes(r.pattern));
}

function stripPlaidToken(data) {
  const response = { ...data };
  if (response.plaid) {
    response.plaid = {
      linked: true,
      accounts: data.plaid.accounts || [],
      lastSynced: data.plaid.lastSynced,
    };
  }
  return response;
}

// --- Routes ---

// Get full state
app.get('/api/data', async (req, res) => {
  try {
    const data = await readData();
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Update balance
app.put('/api/balance', async (req, res) => {
  try {
    const { balance } = req.body;
    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ error: 'Balance must be a non-negative number' });
    }
    const data = await readData();
    data.balance = balance;
    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Create bucket
app.post('/api/buckets', async (req, res) => {
  try {
    const { name, targetAmount, allocatedAmount, color } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (typeof targetAmount !== 'number' || targetAmount < 0) {
      return res.status(400).json({ error: 'Target amount must be a non-negative number' });
    }
    const alloc = typeof allocatedAmount === 'number' ? allocatedAmount : 0;
    if (alloc < 0) {
      return res.status(400).json({ error: 'Allocated amount cannot be negative' });
    }

    const data = await readData();
    const unallocated = data.balance - getTotalAllocated(data.buckets);
    if (alloc > unallocated) {
      return res.status(400).json({ error: `Not enough unallocated funds. Available: $${unallocated.toFixed(2)}` });
    }

    const bucket = {
      id: generateId(),
      name: name.trim(),
      targetAmount,
      allocatedAmount: alloc,
      color: color || '#4F46E5',
      createdAt: new Date().toISOString(),
    };

    data.buckets.push(bucket);
    await writeData(data);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bucket' });
  }
});

// Update bucket
app.put('/api/buckets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, targetAmount, allocatedAmount, color } = req.body;

    const data = await readData();
    const idx = data.buckets.findIndex(b => b.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    const bucket = data.buckets[idx];

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      bucket.name = name.trim();
    }
    if (targetAmount !== undefined) {
      if (typeof targetAmount !== 'number' || targetAmount < 0) {
        return res.status(400).json({ error: 'Target amount must be a non-negative number' });
      }
      bucket.targetAmount = targetAmount;
    }
    if (allocatedAmount !== undefined) {
      if (typeof allocatedAmount !== 'number' || allocatedAmount < 0) {
        return res.status(400).json({ error: 'Allocated amount cannot be negative' });
      }
      const otherAllocated = getTotalAllocated(data.buckets) - bucket.allocatedAmount;
      const available = data.balance - otherAllocated;
      if (allocatedAmount > available) {
        return res.status(400).json({ error: `Not enough unallocated funds. Available: $${available.toFixed(2)}` });
      }
      bucket.allocatedAmount = allocatedAmount;
    }
    if (color !== undefined) {
      bucket.color = color;
    }

    data.buckets[idx] = bucket;
    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bucket' });
  }
});

// Delete bucket
app.delete('/api/buckets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();
    const idx = data.buckets.findIndex(b => b.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Bucket not found' });
    }
    data.buckets.splice(idx, 1);
    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bucket' });
  }
});

// Transfer money between buckets
app.post('/api/buckets/transfer', async (req, res) => {
  try {
    const { fromId, toId, amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be a positive number' });
    }
    if (fromId === toId) {
      return res.status(400).json({ error: 'Cannot transfer to the same bucket' });
    }

    const data = await readData();

    // "unallocated" is a special virtual source/destination
    if (fromId === 'unallocated') {
      const unallocated = data.balance - getTotalAllocated(data.buckets);
      if (amount > unallocated) {
        return res.status(400).json({ error: `Not enough unallocated funds. Available: $${unallocated.toFixed(2)}` });
      }
      const toBucket = data.buckets.find(b => b.id === toId);
      if (!toBucket) return res.status(404).json({ error: 'Destination bucket not found' });
      toBucket.allocatedAmount += amount;
    } else if (toId === 'unallocated') {
      const fromBucket = data.buckets.find(b => b.id === fromId);
      if (!fromBucket) return res.status(404).json({ error: 'Source bucket not found' });
      if (amount > fromBucket.allocatedAmount) {
        return res.status(400).json({ error: `Insufficient funds in bucket. Available: $${fromBucket.allocatedAmount.toFixed(2)}` });
      }
      fromBucket.allocatedAmount -= amount;
    } else {
      const fromBucket = data.buckets.find(b => b.id === fromId);
      const toBucket = data.buckets.find(b => b.id === toId);
      if (!fromBucket) return res.status(404).json({ error: 'Source bucket not found' });
      if (!toBucket) return res.status(404).json({ error: 'Destination bucket not found' });
      if (amount > fromBucket.allocatedAmount) {
        return res.status(400).json({ error: `Insufficient funds in bucket. Available: $${fromBucket.allocatedAmount.toFixed(2)}` });
      }
      fromBucket.allocatedAmount -= amount;
      toBucket.allocatedAmount += amount;
    }

    // Round to avoid floating point drift
    data.buckets.forEach(b => {
      b.allocatedAmount = Math.round(b.allocatedAmount * 100) / 100;
    });

    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer funds' });
  }
});

// --- Transaction Routes ---

// Log a purchase
app.post('/api/transactions', async (req, res) => {
  try {
    const { vendor, amount, bucketId, note, date } = req.body;

    if (!vendor || typeof vendor !== 'string' || !vendor.trim()) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const data = await readData();
    const bucket = data.buckets.find(b => b.id === bucketId);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found' });
    }
    if (amount > bucket.allocatedAmount) {
      return res.status(400).json({
        error: `Insufficient funds in "${bucket.name}". Available: $${bucket.allocatedAmount.toFixed(2)}`
      });
    }
    if (amount > data.balance) {
      return res.status(400).json({
        error: `Insufficient total balance. Available: $${data.balance.toFixed(2)}`
      });
    }

    // Deduct from bucket and balance
    bucket.allocatedAmount = Math.round((bucket.allocatedAmount - amount) * 100) / 100;
    data.balance = Math.round((data.balance - amount) * 100) / 100;

    const transaction = {
      id: generateId(),
      vendor: vendor.trim(),
      amount: Math.round(amount * 100) / 100,
      bucketId,
      note: (note || '').trim(),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    data.transactions.push(transaction);
    await writeData(data);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to log transaction' });
  }
});

// Delete a transaction (refunds amount)
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const txn = data.transactions[idx];

    // Refund to bucket (if it still exists) and balance
    const bucket = data.buckets.find(b => b.id === txn.bucketId);
    if (bucket) {
      bucket.allocatedAmount = Math.round((bucket.allocatedAmount + txn.amount) * 100) / 100;
    }
    data.balance = Math.round((data.balance + txn.amount) * 100) / 100;

    // Note: we intentionally do NOT remove plaidTransactionId from syncedPlaidTxnIds
    // so the transaction won't re-import on next Plaid sync
    data.transactions.splice(idx, 1);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Assign an uncategorized transaction to a bucket
app.put('/api/transactions/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { bucketId } = req.body;

    const data = await readData();
    const txn = data.transactions.find(t => t.id === id);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const newBucket = data.buckets.find(b => b.id === bucketId);
    if (!newBucket) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    // If already assigned, refund old bucket first
    if (txn.bucketId) {
      const oldBucket = data.buckets.find(b => b.id === txn.bucketId);
      if (oldBucket) {
        oldBucket.allocatedAmount = Math.round((oldBucket.allocatedAmount + txn.amount) * 100) / 100;
      }
    }

    // Deduct from new bucket (balance was already deducted at import time)
    newBucket.allocatedAmount = Math.round((newBucket.allocatedAmount - txn.amount) * 100) / 100;
    txn.bucketId = bucketId;

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign transaction' });
  }
});

// --- Auto-Assign Rule Routes ---

// Create an auto-assign rule
app.post('/api/auto-assign-rules', async (req, res) => {
  try {
    const { pattern, bucketId } = req.body;

    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const data = await readData();
    if (!data.buckets.find(b => b.id === bucketId)) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    const normalized = pattern.trim().toLowerCase();
    if (data.autoAssignRules.find(r => r.pattern === normalized)) {
      return res.status(400).json({ error: 'A rule for this pattern already exists' });
    }

    const rule = {
      id: generateId(),
      pattern: normalized,
      bucketId,
      createdAt: new Date().toISOString(),
    };

    data.autoAssignRules.push(rule);
    await writeData(data);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// Delete an auto-assign rule
app.delete('/api/auto-assign-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();
    const idx = data.autoAssignRules.findIndex(r => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    data.autoAssignRules.splice(idx, 1);
    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// --- Plaid Routes ---

// Check if Plaid is configured and linked
app.get('/api/plaid/status', async (req, res) => {
  try {
    const data = await readData();
    res.json({
      configured: !!plaidClient,
      linked: !!(data.plaid && data.plaid.accessToken),
      accounts: data.plaid?.accounts || [],
      sandbox: (process.env.PLAID_ENV || 'sandbox') === 'sandbox',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read Plaid status' });
  }
});

// Create link token for Plaid Link
app.post('/api/plaid/create_link_token', requirePlaid, async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Bucket Budget',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid linkTokenCreate error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token for access token
app.post('/api/plaid/exchange_token', requirePlaid, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    const { access_token, item_id } = exchangeResponse.data;

    // Fetch accounts to store metadata
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });
    const accounts = accountsResponse.data.accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }));

    const data = await readData();
    data.plaid = {
      accessToken: access_token,
      itemId: item_id,
      accounts,
      lastSynced: null,
    };
    await writeData(data);

    res.json({ linked: true, accounts });
  } catch (err) {
    console.error('Plaid exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Sandbox quick-setup: create test accounts (1 checking + 1 credit card) without going through Link
app.post('/api/plaid/sandbox_setup', requirePlaid, async (req, res) => {
  try {
    if ((process.env.PLAID_ENV || 'sandbox') !== 'sandbox') {
      return res.status(400).json({ error: 'Sandbox setup is only available in sandbox mode' });
    }

    const customConfig = JSON.stringify({
      override_accounts: [
        {
          type: 'depository',
          subtype: 'checking',
          starting_balance: 5000,
          meta: {
            name: 'Plaid Checking',
            official_name: 'Plaid Gold Standard Checking',
          },
          numbers: {
            account: '1111222233330000',
            ach_routing: '011401533',
          },
        },
        {
          type: 'credit',
          subtype: 'credit card',
          starting_balance: 1250,
          meta: {
            name: 'Plaid Credit Card',
            official_name: 'Plaid Diamond Credit Card',
            limit: 10000,
          },
        },
      ],
    });

    // Create a sandbox public token with custom accounts
    const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
      institution_id: 'ins_109508', // First Platypus Bank (non-OAuth, reliable)
      initial_products: ['transactions'],
      options: {
        override_username: 'user_custom',
        override_password: customConfig,
      },
    });

    const publicToken = sandboxResponse.data.public_token;

    // Exchange for access token (same as normal flow)
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const { access_token, item_id } = exchangeResponse.data;

    // Fetch accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });
    const accounts = accountsResponse.data.accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }));

    const data = await readData();
    data.plaid = {
      accessToken: access_token,
      itemId: item_id,
      accounts,
      lastSynced: null,
      transactionsCursor: '',
      syncedPlaidTxnIds: [],
    };
    await writeData(data);

    res.json({ linked: true, accounts });
  } catch (err) {
    console.error('Sandbox setup error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to set up sandbox accounts' });
  }
});

// Get stored linked accounts
app.get('/api/plaid/accounts', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    if (!data.plaid?.accessToken) {
      return res.status(400).json({ error: 'No bank account linked' });
    }
    res.json({ accounts: data.plaid.accounts || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Sync balance from Plaid
app.post('/api/plaid/sync_balance', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    if (!data.plaid?.accessToken) {
      return res.status(400).json({ error: 'No bank account linked' });
    }

    const { account_id } = req.body || {};

    const balanceResponse = await plaidClient.accountsBalanceGet({
      access_token: data.plaid.accessToken,
    });

    const accounts = balanceResponse.data.accounts;
    let targetAccount;

    if (account_id) {
      targetAccount = accounts.find(a => a.account_id === account_id);
    } else {
      targetAccount = accounts.find(a => a.subtype === 'checking')
        || accounts.find(a => a.type === 'depository')
        || accounts[0];
    }

    if (!targetAccount) {
      return res.status(404).json({ error: 'No accounts found' });
    }

    data.balance = Math.round(targetAccount.balances.current * 100) / 100;
    data.plaid.lastSynced = new Date().toISOString();
    data.plaid.accounts = accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }));

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    console.error('Plaid balance sync error:', err.response?.data || err.message);
    if (err.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      return res.status(400).json({
        error: 'Bank connection expired. Please re-link your account.',
        relink: true,
      });
    }
    res.status(500).json({ error: 'Failed to sync balance from bank' });
  }
});

// Sync transactions from Plaid (credit cards + bank accounts)
app.post('/api/plaid/sync_transactions', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    if (!data.plaid?.accessToken) {
      return res.status(400).json({ error: 'No account linked' });
    }

    let cursor = data.plaid.transactionsCursor || '';
    const allAdded = [];
    const allModified = [];
    const allRemoved = [];

    // Paginate through all available updates
    let hasMore = true;
    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: data.plaid.accessToken,
        cursor: cursor,
        count: 500,
      });
      allAdded.push(...syncResponse.data.added);
      allModified.push(...syncResponse.data.modified);
      allRemoved.push(...syncResponse.data.removed);
      hasMore = syncResponse.data.has_more;
      cursor = syncResponse.data.next_cursor;
    }

    // --- Process Removals ---
    let removedCount = 0;
    for (const removed of allRemoved) {
      const idx = data.transactions.findIndex(t => t.plaidTransactionId === removed.transaction_id);
      if (idx !== -1) {
        const txn = data.transactions[idx];
        if (txn.bucketId) {
          const bucket = data.buckets.find(b => b.id === txn.bucketId);
          if (bucket) {
            bucket.allocatedAmount = Math.round((bucket.allocatedAmount + txn.amount) * 100) / 100;
          }
        }
        data.balance = Math.round((data.balance + txn.amount) * 100) / 100;
        data.transactions.splice(idx, 1);
        removedCount++;
      }
      const syncedIdx = data.plaid.syncedPlaidTxnIds.indexOf(removed.transaction_id);
      if (syncedIdx !== -1) data.plaid.syncedPlaidTxnIds.splice(syncedIdx, 1);
    }

    // --- Process Modifications ---
    let modifiedCount = 0;
    for (const modified of allModified) {
      const existing = data.transactions.find(t => t.plaidTransactionId === modified.transaction_id);
      if (existing) {
        // Refund old amount
        if (existing.bucketId) {
          const bucket = data.buckets.find(b => b.id === existing.bucketId);
          if (bucket) {
            bucket.allocatedAmount = Math.round((bucket.allocatedAmount + existing.amount) * 100) / 100;
          }
        }
        data.balance = Math.round((data.balance + existing.amount) * 100) / 100;

        // Apply new amount
        const newAmount = Math.round(Math.abs(modified.amount) * 100) / 100;
        const newVendor = modified.merchant_name || modified.name || existing.vendor;

        // Re-run auto-assign with new vendor name
        const matchedRule = findAutoAssignRule(data.autoAssignRules, newVendor);
        const newBucketId = matchedRule ? matchedRule.bucketId : existing.bucketId;

        if (newBucketId) {
          const bucket = data.buckets.find(b => b.id === newBucketId);
          if (bucket) {
            bucket.allocatedAmount = Math.round((bucket.allocatedAmount - newAmount) * 100) / 100;
          }
        }
        data.balance = Math.round((data.balance - newAmount) * 100) / 100;

        existing.vendor = newVendor;
        existing.amount = newAmount;
        existing.bucketId = newBucketId;
        existing.date = new Date(modified.date).toISOString();
        modifiedCount++;
      }
    }

    // --- Process Additions ---
    let addedCount = 0;
    let autoAssignedCount = 0;

    for (const added of allAdded) {
      // Skip if already imported (dedup)
      if (data.plaid.syncedPlaidTxnIds.includes(added.transaction_id)) continue;
      // Skip pending transactions (they'll settle later)
      if (added.pending) continue;
      // Plaid: positive amount = money out (purchase), negative = money in (refund/payment)
      // Only import purchases (positive amounts)
      if (added.amount <= 0) continue;

      const amount = Math.round(Math.abs(added.amount) * 100) / 100;
      const vendor = added.merchant_name || added.name || 'Unknown';

      // Run auto-assign rules
      const matchedRule = findAutoAssignRule(data.autoAssignRules, vendor);
      const bucketId = matchedRule ? matchedRule.bucketId : null;
      if (matchedRule) autoAssignedCount++;

      // Deduct from bucket (if matched) and balance
      if (bucketId) {
        const bucket = data.buckets.find(b => b.id === bucketId);
        if (bucket) {
          bucket.allocatedAmount = Math.round((bucket.allocatedAmount - amount) * 100) / 100;
        }
      }
      data.balance = Math.round((data.balance - amount) * 100) / 100;

      data.transactions.push({
        id: generateId(),
        vendor,
        amount,
        bucketId,
        note: '',
        date: new Date(added.date).toISOString(),
        createdAt: new Date().toISOString(),
        plaidTransactionId: added.transaction_id,
        source: 'plaid',
        plaidAccountId: added.account_id,
      });

      data.plaid.syncedPlaidTxnIds.push(added.transaction_id);
      addedCount++;
    }

    // Update cursor and timestamp
    data.plaid.transactionsCursor = cursor;
    data.plaid.lastSynced = new Date().toISOString();
    await writeData(data);

    const response = stripPlaidToken(data);
    response.syncSummary = {
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
      autoAssigned: autoAssignedCount,
      uncategorized: addedCount - autoAssignedCount,
    };
    res.json(response);
  } catch (err) {
    console.error('Plaid transaction sync error:', err.response?.data || err.message);
    if (err.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      return res.status(400).json({
        error: 'Bank connection expired. Please re-link your account.',
        relink: true,
      });
    }
    res.status(500).json({ error: 'Failed to sync transactions from bank' });
  }
});

// Disconnect bank account
app.delete('/api/plaid/disconnect', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    if (data.plaid?.accessToken) {
      try {
        await plaidClient.itemRemove({ access_token: data.plaid.accessToken });
      } catch (plaidErr) {
        console.error('Plaid itemRemove error:', plaidErr.response?.data || plaidErr.message);
      }
    }
    delete data.plaid;
    await writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect bank account' });
  }
});

app.listen(PORT, () => {
  console.log(`Bucket Budget running at http://localhost:${PORT}`);
});
