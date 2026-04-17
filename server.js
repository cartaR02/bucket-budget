require('dotenv').config();
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const DEFAULT_DATA = { pools: [], activePoolId: null };

app.use(express.json());

// Service worker must be served with no-cache so updates propagate immediately
app.get('/service-worker.js', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    } else {
      res.set('Cache-Control', 'public, max-age=3600');
    }
  },
}));

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

    // --- Migration: old flat format → pools format ---
    if (!data.pools) {
      const poolId = generateId();
      const pool = {
        id: poolId,
        name: 'My Budget',
        type: 'spending',
        linkedAccountIds: (data.plaid?.accounts || []).map(a => a.id),
        balance: data.balance || 0,
        buckets: data.buckets || [],
        transactions: data.transactions || [],
        autoAssignRules: data.autoAssignRules || [],
        createdAt: new Date().toISOString(),
      };

      const migrated = {
        pools: [pool],
        activePoolId: poolId,
      };

      // Preserve plaid connection
      if (data.plaid) {
        migrated.plaid = data.plaid;
        if (!migrated.plaid.transactionsCursor) migrated.plaid.transactionsCursor = '';
        if (!migrated.plaid.syncedPlaidTxnIds) migrated.plaid.syncedPlaidTxnIds = [];
      }

      await writeData(migrated);
      return migrated;
    }

    // --- Migration: add accumulatedAmount to savings buckets ---
    let needsWrite = false;
    for (const pool of data.pools) {
      if (pool.type === 'savings') {
        for (const bucket of pool.buckets) {
          if (bucket.accumulatedAmount === undefined) {
            bucket.accumulatedAmount = 0;
            needsWrite = true;
          }
        }
      }
    }
    if (needsWrite) await writeData(data);

    // --- Migration: single plaid item → multi-item array ---
    if (data.plaid && data.plaid.accessToken && !data.plaid.items) {
      const oldPlaid = data.plaid;
      data.plaid = {
        items: [{
          accessToken: oldPlaid.accessToken,
          itemId: oldPlaid.itemId,
          accounts: oldPlaid.accounts || [],
          transactionsCursor: oldPlaid.transactionsCursor || '',
          syncedPlaidTxnIds: oldPlaid.syncedPlaidTxnIds || [],
        }],
        lastSynced: oldPlaid.lastSynced,
      };
      needsWrite = true;
    }

    // Backfill plaid items fields
    if (data.plaid?.items) {
      for (const item of data.plaid.items) {
        if (!item.transactionsCursor) item.transactionsCursor = '';
        if (!item.syncedPlaidTxnIds) item.syncedPlaidTxnIds = [];
      }
    }

    if (needsWrite) await writeData(data);

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

function getPool(data, poolId) {
  return data.pools.find(p => p.id === poolId);
}

function getTotalAllocated(buckets) {
  return buckets.reduce((sum, b) => sum + (b.allocatedAmount || 0), 0);
}

function getTotalPercentage(buckets) {
  return buckets.reduce((sum, b) => sum + (b.percentage || 0), 0);
}

function findAutoAssignRule(rules, vendorName) {
  const vendorLower = (vendorName || '').trim().toLowerCase();
  if (!vendorLower) return null;
  return rules.find(r => vendorLower.includes(r.pattern));
}

function stripPlaidToken(data) {
  const response = { ...data };
  if (response.plaid?.items) {
    response.plaid = {
      linked: data.plaid.items.length > 0,
      items: data.plaid.items.map(item => ({
        itemId: item.itemId,
        accounts: item.accounts || [],
      })),
      accounts: data.plaid.items.flatMap(item => item.accounts || []),
      lastSynced: data.plaid.lastSynced,
    };
  }
  return response;
}

// Middleware to load pool from :poolId param
function loadPool(req, res, next) {
  // Pool will be loaded after readData in the route handler
  req.poolId = req.params.poolId;
  next();
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

// --- Pool CRUD ---

// Create pool
app.post('/api/pools', async (req, res) => {
  try {
    const { name, type, linkedAccountIds } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!['spending', 'savings'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "spending" or "savings"' });
    }

    const data = await readData();
    const pool = {
      id: generateId(),
      name: name.trim(),
      type,
      linkedAccountIds: Array.isArray(linkedAccountIds) ? linkedAccountIds : [],
      balance: 0,
      buckets: [],
      transactions: [],
      autoAssignRules: [],
      createdAt: new Date().toISOString(),
    };

    data.pools.push(pool);
    data.activePoolId = pool.id;
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pool' });
  }
});

// Update pool
app.put('/api/pools/:poolId', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const { name, linkedAccountIds } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      pool.name = name.trim();
    }
    if (linkedAccountIds !== undefined) {
      pool.linkedAccountIds = Array.isArray(linkedAccountIds) ? linkedAccountIds : [];
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pool' });
  }
});

// Delete pool
app.delete('/api/pools/:poolId', async (req, res) => {
  try {
    const data = await readData();
    const idx = data.pools.findIndex(p => p.id === req.params.poolId);
    if (idx === -1) return res.status(404).json({ error: 'Pool not found' });

    data.pools.splice(idx, 1);
    if (data.activePoolId === req.params.poolId) {
      data.activePoolId = data.pools.length > 0 ? data.pools[0].id : null;
    }
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete pool' });
  }
});

// Set active pool
app.put('/api/pools/:poolId/active', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    data.activePoolId = pool.id;
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to set active pool' });
  }
});

// --- Pool-scoped routes ---

// Update balance for a pool
app.put('/api/pools/:poolId/balance', async (req, res) => {
  try {
    const { balance } = req.body;
    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ error: 'Balance must be a non-negative number' });
    }
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    pool.balance = balance;
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Log a deposit to a savings pool (income-aware allocation)
app.post('/api/pools/:poolId/deposit', async (req, res) => {
  try {
    const { checkTotal, depositAmount, date, note } = req.body;

    if (typeof checkTotal !== 'number' || checkTotal <= 0) {
      return res.status(400).json({ error: 'Check total must be a positive number' });
    }
    if (typeof depositAmount !== 'number' || depositAmount <= 0) {
      return res.status(400).json({ error: 'Deposit amount must be a positive number' });
    }
    if (depositAmount > checkTotal) {
      return res.status(400).json({ error: 'Deposit amount cannot exceed check total' });
    }

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    if (pool.type !== 'savings') {
      return res.status(400).json({ error: 'Deposits are only for savings pools' });
    }

    let remaining = Math.round(depositAmount * 100) / 100;
    const allocations = [];

    // Priority-based filling: buckets fill in array order
    for (const bucket of pool.buckets) {
      if (remaining <= 0) break;
      const need = Math.round(checkTotal * (bucket.percentage || 0)) / 100;
      const allocated = Math.round(Math.min(need, remaining) * 100) / 100;
      if (allocated > 0) {
        bucket.accumulatedAmount = Math.round(((bucket.accumulatedAmount || 0) + allocated) * 100) / 100;
        remaining = Math.round((remaining - allocated) * 100) / 100;
        allocations.push({ bucketId: bucket.id, amount: allocated });
      }
    }

    pool.balance = Math.round((pool.balance + depositAmount) * 100) / 100;

    const transaction = {
      id: generateId(),
      type: 'deposit',
      vendor: 'Deposit',
      amount: Math.round(depositAmount * 100) / 100,
      checkTotal: Math.round(checkTotal * 100) / 100,
      allocations,
      bucketId: null,
      note: (note || '').trim(),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    pool.transactions.push(transaction);
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to log deposit' });
  }
});

// Create bucket in pool
app.post('/api/pools/:poolId/buckets', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (pool.type === 'savings') {
      // Percentage-based bucket
      const { percentage } = req.body;
      if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) {
        return res.status(400).json({ error: 'Percentage must be between 1 and 100' });
      }
      const used = getTotalPercentage(pool.buckets);
      if (used + percentage > 100) {
        return res.status(400).json({ error: `Only ${100 - used}% available` });
      }

      pool.buckets.push({
        id: generateId(),
        name: name.trim(),
        percentage: Math.round(percentage * 100) / 100,
        accumulatedAmount: 0,
        color: color || '#4F46E5',
        createdAt: new Date().toISOString(),
      });
    } else {
      // Dollar-based bucket (spending)
      const { targetAmount, allocatedAmount } = req.body;
      if (typeof targetAmount !== 'number' || targetAmount < 0) {
        return res.status(400).json({ error: 'Target amount must be a non-negative number' });
      }
      const alloc = typeof allocatedAmount === 'number' ? allocatedAmount : 0;
      if (alloc < 0) {
        return res.status(400).json({ error: 'Allocated amount cannot be negative' });
      }
      const unallocated = pool.balance - getTotalAllocated(pool.buckets);
      if (alloc > unallocated) {
        return res.status(400).json({ error: `Not enough unallocated funds. Available: $${unallocated.toFixed(2)}` });
      }

      pool.buckets.push({
        id: generateId(),
        name: name.trim(),
        targetAmount,
        allocatedAmount: alloc,
        color: color || '#4F46E5',
        createdAt: new Date().toISOString(),
      });
    }

    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bucket' });
  }
});

// Update bucket in pool
app.put('/api/pools/:poolId/buckets/:id', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.buckets.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Bucket not found' });

    const bucket = pool.buckets[idx];
    const { name, color } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      bucket.name = name.trim();
    }
    if (color !== undefined) bucket.color = color;

    if (pool.type === 'savings') {
      const { percentage } = req.body;
      if (percentage !== undefined) {
        if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) {
          return res.status(400).json({ error: 'Percentage must be between 1 and 100' });
        }
        const otherPct = getTotalPercentage(pool.buckets) - (bucket.percentage || 0);
        if (otherPct + percentage > 100) {
          return res.status(400).json({ error: `Only ${100 - otherPct}% available` });
        }
        bucket.percentage = Math.round(percentage * 100) / 100;
      }
    } else {
      const { targetAmount, allocatedAmount } = req.body;
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
        const otherAllocated = getTotalAllocated(pool.buckets) - (bucket.allocatedAmount || 0);
        const available = pool.balance - otherAllocated;
        if (allocatedAmount > available) {
          return res.status(400).json({ error: `Not enough unallocated funds. Available: $${available.toFixed(2)}` });
        }
        bucket.allocatedAmount = allocatedAmount;
      }
    }

    pool.buckets[idx] = bucket;
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bucket' });
  }
});

// Delete bucket from pool
app.delete('/api/pools/:poolId/buckets/:id', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.buckets.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Bucket not found' });
    pool.buckets.splice(idx, 1);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bucket' });
  }
});

// Transfer money between buckets (spending pools only)
app.post('/api/pools/:poolId/buckets/transfer', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    if (pool.type === 'savings') {
      return res.status(400).json({ error: 'Transfers are not available for savings pools' });
    }

    const { fromId, toId, amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be a positive number' });
    }
    if (fromId === toId) {
      return res.status(400).json({ error: 'Cannot transfer to the same bucket' });
    }

    if (fromId === 'unallocated') {
      const unallocated = pool.balance - getTotalAllocated(pool.buckets);
      if (amount > unallocated) {
        return res.status(400).json({ error: `Not enough unallocated funds. Available: $${unallocated.toFixed(2)}` });
      }
      const toBucket = pool.buckets.find(b => b.id === toId);
      if (!toBucket) return res.status(404).json({ error: 'Destination bucket not found' });
      toBucket.allocatedAmount += amount;
    } else if (toId === 'unallocated') {
      const fromBucket = pool.buckets.find(b => b.id === fromId);
      if (!fromBucket) return res.status(404).json({ error: 'Source bucket not found' });
      if (amount > fromBucket.allocatedAmount) {
        return res.status(400).json({ error: `Insufficient funds in bucket. Available: $${fromBucket.allocatedAmount.toFixed(2)}` });
      }
      fromBucket.allocatedAmount -= amount;
    } else {
      const fromBucket = pool.buckets.find(b => b.id === fromId);
      const toBucket = pool.buckets.find(b => b.id === toId);
      if (!fromBucket) return res.status(404).json({ error: 'Source bucket not found' });
      if (!toBucket) return res.status(404).json({ error: 'Destination bucket not found' });
      if (amount > fromBucket.allocatedAmount) {
        return res.status(400).json({ error: `Insufficient funds in bucket. Available: $${fromBucket.allocatedAmount.toFixed(2)}` });
      }
      fromBucket.allocatedAmount -= amount;
      toBucket.allocatedAmount += amount;
    }

    pool.buckets.forEach(b => {
      if (b.allocatedAmount !== undefined) {
        b.allocatedAmount = Math.round(b.allocatedAmount * 100) / 100;
      }
    });

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer funds' });
  }
});

// --- Transaction Routes (pool-scoped) ---

// Log a purchase
app.post('/api/pools/:poolId/transactions', async (req, res) => {
  try {
    const { vendor, amount, bucketId, note, date } = req.body;

    if (!vendor || typeof vendor !== 'string' || !vendor.trim()) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    if (pool.type === 'spending') {
      const bucket = pool.buckets.find(b => b.id === bucketId);
      if (!bucket) return res.status(404).json({ error: 'Bucket not found' });
      if (amount > bucket.allocatedAmount) {
        return res.status(400).json({
          error: `Insufficient funds in "${bucket.name}". Available: $${bucket.allocatedAmount.toFixed(2)}`
        });
      }
      if (amount > pool.balance) {
        return res.status(400).json({
          error: `Insufficient total balance. Available: $${pool.balance.toFixed(2)}`
        });
      }
      bucket.allocatedAmount = Math.round((bucket.allocatedAmount - amount) * 100) / 100;
    } else {
      // Savings: deduct from balance and bucket's accumulated amount
      if (amount > pool.balance) {
        return res.status(400).json({
          error: `Insufficient balance. Available: $${pool.balance.toFixed(2)}`
        });
      }
      if (bucketId) {
        const bucket = pool.buckets.find(b => b.id === bucketId);
        if (bucket && bucket.accumulatedAmount !== undefined) {
          bucket.accumulatedAmount = Math.round(((bucket.accumulatedAmount || 0) - amount) * 100) / 100;
          if (bucket.accumulatedAmount < 0) bucket.accumulatedAmount = 0;
        }
      }
    }

    pool.balance = Math.round((pool.balance - amount) * 100) / 100;

    const transaction = {
      id: generateId(),
      vendor: vendor.trim(),
      amount: Math.round(amount * 100) / 100,
      bucketId: bucketId || null,
      note: (note || '').trim(),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    pool.transactions.push(transaction);
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to log transaction' });
  }
});

// Delete a transaction (refunds amount)
app.delete('/api/pools/:poolId/transactions/:id', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.transactions.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

    const txn = pool.transactions[idx];

    if (txn.type === 'deposit') {
      // Reverse deposit: undo each bucket allocation, deduct from balance
      for (const alloc of (txn.allocations || [])) {
        const bucket = pool.buckets.find(b => b.id === alloc.bucketId);
        if (bucket) {
          bucket.accumulatedAmount = Math.round(((bucket.accumulatedAmount || 0) - alloc.amount) * 100) / 100;
          if (bucket.accumulatedAmount < 0) bucket.accumulatedAmount = 0;
        }
      }
      pool.balance = Math.round((pool.balance - txn.amount) * 100) / 100;
      if (pool.balance < 0) pool.balance = 0;
    } else {
      // Reverse withdrawal/purchase: refund to balance (and bucket if applicable)
      if (pool.type === 'spending' && txn.bucketId) {
        const bucket = pool.buckets.find(b => b.id === txn.bucketId);
        if (bucket) {
          bucket.allocatedAmount = Math.round((bucket.allocatedAmount + txn.amount) * 100) / 100;
        }
      }
      if (pool.type === 'savings' && txn.bucketId) {
        const bucket = pool.buckets.find(b => b.id === txn.bucketId);
        if (bucket && bucket.accumulatedAmount !== undefined) {
          bucket.accumulatedAmount = Math.round(((bucket.accumulatedAmount || 0) + txn.amount) * 100) / 100;
        }
      }
      pool.balance = Math.round((pool.balance + txn.amount) * 100) / 100;
    }

    pool.transactions.splice(idx, 1);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Assign an uncategorized transaction to a bucket
app.put('/api/pools/:poolId/transactions/:id/assign', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const txn = pool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const { bucketId } = req.body;
    const newBucket = pool.buckets.find(b => b.id === bucketId);
    if (!newBucket) return res.status(404).json({ error: 'Bucket not found' });

    if (pool.type === 'spending') {
      // Refund old bucket if assigned
      if (txn.bucketId) {
        const oldBucket = pool.buckets.find(b => b.id === txn.bucketId);
        if (oldBucket) {
          oldBucket.allocatedAmount = Math.round((oldBucket.allocatedAmount + txn.amount) * 100) / 100;
        }
      }
      // Deduct from new bucket
      newBucket.allocatedAmount = Math.round((newBucket.allocatedAmount - txn.amount) * 100) / 100;
    }

    txn.bucketId = bucketId;
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign transaction' });
  }
});

// --- Auto-Assign Rule Routes (pool-scoped) ---

app.post('/api/pools/:poolId/auto-assign-rules', async (req, res) => {
  try {
    const { pattern, bucketId } = req.body;
    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    if (!pool.buckets.find(b => b.id === bucketId)) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    const normalized = pattern.trim().toLowerCase();
    if (pool.autoAssignRules.find(r => r.pattern === normalized)) {
      return res.status(400).json({ error: 'A rule for this pattern already exists' });
    }

    pool.autoAssignRules.push({
      id: generateId(),
      pattern: normalized,
      bucketId,
      createdAt: new Date().toISOString(),
    });

    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

app.delete('/api/pools/:poolId/auto-assign-rules/:id', async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.autoAssignRules.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Rule not found' });
    pool.autoAssignRules.splice(idx, 1);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// --- Plaid Routes ---

app.get('/api/plaid/status', async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    res.json({
      configured: !!plaidClient,
      linked: items.length > 0,
      items: items.map(item => ({ itemId: item.itemId, accounts: item.accounts || [] })),
      accounts: items.flatMap(item => item.accounts || []),
      sandbox: (process.env.PLAID_ENV || 'sandbox') === 'sandbox',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read Plaid status' });
  }
});

app.post('/api/plaid/create_link_token', requirePlaid, async (req, res) => {
  try {
    const host = req.headers.origin || `http://localhost:${PORT}`;
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Bucket Budget',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: `${host}/plaid-oauth-return.html`,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid linkTokenCreate error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/plaid/exchange_token', requirePlaid, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    const accountsResponse = await plaidClient.accountsGet({ access_token });
    const accounts = accountsResponse.data.accounts.map(a => ({
      id: a.account_id,
      name: a.name,
      officialName: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }));

    const data = await readData();
    if (!data.plaid) data.plaid = { items: [], lastSynced: null };
    if (!data.plaid.items) data.plaid.items = [];

    data.plaid.items.push({
      accessToken: access_token,
      itemId: item_id,
      accounts,
      transactionsCursor: '',
      syncedPlaidTxnIds: [],
    });
    await writeData(data);

    const allAccounts = data.plaid.items.flatMap(i => i.accounts || []);
    res.json({ linked: true, accounts: allAccounts });
  } catch (err) {
    console.error('Plaid exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

app.post('/api/plaid/sandbox_setup', requirePlaid, async (req, res) => {
  try {
    if ((process.env.PLAID_ENV || 'sandbox') !== 'sandbox') {
      return res.status(400).json({ error: 'Sandbox setup is only available in sandbox mode' });
    }

    const customConfig = JSON.stringify({
      override_accounts: [
        {
          type: 'depository', subtype: 'checking', starting_balance: 5000,
          meta: { name: 'Plaid Checking', official_name: 'Plaid Gold Standard Checking' },
          numbers: { account: '1111222233330000', ach_routing: '011401533' },
        },
        {
          type: 'credit', subtype: 'credit card', starting_balance: 1250,
          meta: { name: 'Plaid Credit Card', official_name: 'Plaid Diamond Credit Card', limit: 10000 },
        },
      ],
    });

    const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
      institution_id: 'ins_109508',
      initial_products: ['transactions'],
      options: { override_username: 'user_custom', override_password: customConfig },
    });

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: sandboxResponse.data.public_token,
    });
    const { access_token, item_id } = exchangeResponse.data;

    const accountsResponse = await plaidClient.accountsGet({ access_token });
    const accounts = accountsResponse.data.accounts.map(a => ({
      id: a.account_id, name: a.name, officialName: a.official_name,
      type: a.type, subtype: a.subtype, mask: a.mask,
    }));

    const data = await readData();
    if (!data.plaid) data.plaid = { items: [], lastSynced: null };
    if (!data.plaid.items) data.plaid.items = [];

    data.plaid.items.push({
      accessToken: access_token, itemId: item_id, accounts,
      transactionsCursor: '', syncedPlaidTxnIds: [],
    });
    await writeData(data);

    const allAccounts = data.plaid.items.flatMap(i => i.accounts || []);
    res.json({ linked: true, accounts: allAccounts });
  } catch (err) {
    console.error('Sandbox setup error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to set up sandbox accounts' });
  }
});

app.get('/api/plaid/accounts', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No bank account linked' });
    }
    const allAccounts = items.flatMap(i => i.accounts || []);
    res.json({ accounts: allAccounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Sync balance — updates each pool based on its linked accounts
app.post('/api/plaid/sync_balance', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No bank account linked' });
    }

    // Fetch balances from all items
    const allPlaidAccounts = [];
    for (const item of items) {
      const balanceResponse = await plaidClient.accountsGet({
        access_token: item.accessToken,
      });
      const accounts = balanceResponse.data.accounts;
      allPlaidAccounts.push(...accounts);

      // Update account metadata for this item
      item.accounts = accounts.map(a => ({
        id: a.account_id, name: a.name, officialName: a.official_name,
        type: a.type, subtype: a.subtype, mask: a.mask,
      }));
    }

    // Update each pool's balance based on its linked accounts
    for (const pool of data.pools) {
      if (pool.linkedAccountIds.length === 0) continue;
      let poolBalance = 0;
      for (const acctId of pool.linkedAccountIds) {
        const acct = allPlaidAccounts.find(a => a.account_id === acctId);
        if (acct) {
          poolBalance += acct.balances.current || 0;
        }
      }
      pool.balance = Math.round(poolBalance * 100) / 100;
    }

    data.plaid.lastSynced = new Date().toISOString();
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    console.error('Plaid balance sync error:', err.response?.data || err.message);
    if (err.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      return res.status(400).json({ error: 'Bank connection expired. Please re-link your account.', relink: true });
    }
    res.status(500).json({ error: 'Failed to sync balance from bank' });
  }
});

// Sync transactions — routes to correct pool by account
app.post('/api/plaid/sync_transactions', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No account linked' });
    }

    // Collect transactions from all items
    const allAdded = [];
    const allModified = [];
    const allRemoved = [];
    // Track which item owns which synced txn IDs
    const allSyncedIds = new Set(items.flatMap(i => i.syncedPlaidTxnIds || []));

    for (const item of items) {
      let cursor = item.transactionsCursor || '';
      let hasMore = true;
      while (hasMore) {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor, count: 500,
        });
        allAdded.push(...syncResponse.data.added);
        allModified.push(...syncResponse.data.modified);
        allRemoved.push(...syncResponse.data.removed);
        hasMore = syncResponse.data.has_more;
        cursor = syncResponse.data.next_cursor;
      }
      item.transactionsCursor = cursor;
    }

    // Helper: find pool that owns an account ID
    function findPoolForAccount(accountId) {
      return data.pools.find(p => p.linkedAccountIds.includes(accountId));
    }

    // Helper: find the item that owns a transaction ID (for syncedPlaidTxnIds tracking)
    function findItemForAccount(accountId) {
      return items.find(item => (item.accounts || []).some(a => a.id === accountId));
    }

    // --- Process Removals ---
    let removedCount = 0;
    for (const removed of allRemoved) {
      for (const pool of data.pools) {
        const idx = pool.transactions.findIndex(t => t.plaidTransactionId === removed.transaction_id);
        if (idx !== -1) {
          const txn = pool.transactions[idx];
          if (pool.type === 'spending' && txn.bucketId) {
            const bucket = pool.buckets.find(b => b.id === txn.bucketId);
            if (bucket) bucket.allocatedAmount = Math.round((bucket.allocatedAmount + txn.amount) * 100) / 100;
          }
          pool.balance = Math.round((pool.balance + txn.amount) * 100) / 100;
          pool.transactions.splice(idx, 1);
          removedCount++;
          break;
        }
      }
      // Remove from the appropriate item's syncedPlaidTxnIds
      for (const item of items) {
        const syncedIdx = (item.syncedPlaidTxnIds || []).indexOf(removed.transaction_id);
        if (syncedIdx !== -1) { item.syncedPlaidTxnIds.splice(syncedIdx, 1); break; }
      }
    }

    // --- Process Modifications ---
    let modifiedCount = 0;
    for (const modified of allModified) {
      for (const pool of data.pools) {
        const existing = pool.transactions.find(t => t.plaidTransactionId === modified.transaction_id);
        if (!existing) continue;

        // Refund old amount
        if (pool.type === 'spending' && existing.bucketId) {
          const bucket = pool.buckets.find(b => b.id === existing.bucketId);
          if (bucket) bucket.allocatedAmount = Math.round((bucket.allocatedAmount + existing.amount) * 100) / 100;
        }
        pool.balance = Math.round((pool.balance + existing.amount) * 100) / 100;

        // Apply new amount
        const newAmount = Math.round(Math.abs(modified.amount) * 100) / 100;
        const newVendor = modified.merchant_name || modified.name || existing.vendor;
        const matchedRule = findAutoAssignRule(pool.autoAssignRules, newVendor);
        const newBucketId = matchedRule ? matchedRule.bucketId : existing.bucketId;

        if (pool.type === 'spending' && newBucketId) {
          const bucket = pool.buckets.find(b => b.id === newBucketId);
          if (bucket) bucket.allocatedAmount = Math.round((bucket.allocatedAmount - newAmount) * 100) / 100;
        }
        pool.balance = Math.round((pool.balance - newAmount) * 100) / 100;

        existing.vendor = newVendor;
        existing.amount = newAmount;
        existing.bucketId = newBucketId;
        existing.date = new Date(modified.date).toISOString();
        modifiedCount++;
        break;
      }
    }

    // --- Process Additions ---
    let addedCount = 0;
    let autoAssignedCount = 0;

    for (const added of allAdded) {
      if (allSyncedIds.has(added.transaction_id)) continue;
      if (added.pending) continue;
      if (added.amount <= 0) continue;

      const pool = findPoolForAccount(added.account_id);
      if (!pool) continue; // Skip transactions for unlinked accounts

      const amount = Math.round(Math.abs(added.amount) * 100) / 100;
      const vendor = added.merchant_name || added.name || 'Unknown';

      const matchedRule = findAutoAssignRule(pool.autoAssignRules, vendor);
      const bucketId = matchedRule ? matchedRule.bucketId : null;
      if (matchedRule) autoAssignedCount++;

      if (pool.type === 'spending' && bucketId) {
        const bucket = pool.buckets.find(b => b.id === bucketId);
        if (bucket) bucket.allocatedAmount = Math.round((bucket.allocatedAmount - amount) * 100) / 100;
      }
      pool.balance = Math.round((pool.balance - amount) * 100) / 100;

      pool.transactions.push({
        id: generateId(),
        vendor, amount, bucketId,
        note: '',
        date: new Date(added.date).toISOString(),
        createdAt: new Date().toISOString(),
        plaidTransactionId: added.transaction_id,
        source: 'plaid',
        plaidAccountId: added.account_id,
      });

      // Add to the correct item's syncedPlaidTxnIds
      const ownerItem = findItemForAccount(added.account_id);
      if (ownerItem) ownerItem.syncedPlaidTxnIds.push(added.transaction_id);
      allSyncedIds.add(added.transaction_id);
      addedCount++;
    }

    data.plaid.lastSynced = new Date().toISOString();
    await writeData(data);

    const response = stripPlaidToken(data);
    response.syncSummary = {
      added: addedCount, modified: modifiedCount, removed: removedCount,
      autoAssigned: autoAssignedCount, uncategorized: addedCount - autoAssignedCount,
    };
    res.json(response);
  } catch (err) {
    console.error('Plaid transaction sync error:', err.response?.data || err.message);
    if (err.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      return res.status(400).json({ error: 'Bank connection expired. Please re-link your account.', relink: true });
    }
    res.status(500).json({ error: 'Failed to sync transactions from bank' });
  }
});

// Disconnect bank account (specific item or all)
app.delete('/api/plaid/disconnect', requirePlaid, async (req, res) => {
  try {
    const data = await readData();
    const targetItemId = req.query.itemId;
    const items = data.plaid?.items || [];

    if (targetItemId) {
      // Disconnect a specific institution
      const itemIdx = items.findIndex(i => i.itemId === targetItemId);
      if (itemIdx === -1) return res.status(404).json({ error: 'Item not found' });

      const item = items[itemIdx];
      try {
        await plaidClient.itemRemove({ access_token: item.accessToken });
      } catch (plaidErr) {
        console.error('Plaid itemRemove error:', plaidErr.response?.data || plaidErr.message);
      }

      // Remove linked account IDs for this item's accounts from all pools
      const removedAccountIds = new Set((item.accounts || []).map(a => a.id));
      for (const pool of data.pools) {
        pool.linkedAccountIds = pool.linkedAccountIds.filter(id => !removedAccountIds.has(id));
      }

      items.splice(itemIdx, 1);
    } else {
      // Disconnect all
      for (const item of items) {
        try {
          await plaidClient.itemRemove({ access_token: item.accessToken });
        } catch (plaidErr) {
          console.error('Plaid itemRemove error:', plaidErr.response?.data || plaidErr.message);
        }
      }
      data.plaid.items = [];
      for (const pool of data.pools) {
        pool.linkedAccountIds = [];
      }
    }

    if (data.plaid.items.length === 0) {
      delete data.plaid;
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect bank account' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bucket Budget running at http://0.0.0.0:${PORT}`);
});
