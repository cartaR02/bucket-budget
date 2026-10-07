require('dotenv').config();
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SCHEMA_VERSION = 2;

// Behind Fly's proxy, trust X-Forwarded-* so req.secure and req.ip reflect the real client
if (process.env.TRUST_PROXY || process.env.FLY_APP_NAME) {
  app.set('trust proxy', 1);
}

app.use(express.json());
// Express 5 leaves req.body undefined when a request has no JSON body
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

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

// --- Optional password lock ---
// When APP_PASSWORD is set, every /api route except session/login/logout requires the
// session cookie handed out by POST /api/login. Static files stay public; they hold no data.

const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_COOKIE = 'bb_session';
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
// Derived from the password, so changing APP_PASSWORD signs everyone out
const SESSION_KEY = crypto.createHash('sha256').update(`bucket-budget-session|${APP_PASSWORD}`).digest();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map(); // ip -> { count, resetAt }

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function sessionSignature(expiresAt) {
  return crypto.createHmac('sha256', SESSION_KEY).update(`v1.${expiresAt}`).digest('base64url');
}

function createSessionToken() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  return `v1.${expiresAt}.${sessionSignature(expiresAt)}`;
}

function isAuthenticated(req) {
  if (!APP_PASSWORD) return true;
  const parts = (readCookie(req, SESSION_COOKIE) || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !(Number(parts[1]) > Date.now())) return false;
  const expected = Buffer.from(sessionSignature(parts[1]));
  const actual = Buffer.from(parts[2]);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function passwordMatches(password) {
  // Compare fixed-length digests so the check takes the same time for any input
  const given = crypto.createHash('sha256').update(password).digest();
  const expected = crypto.createHash('sha256').update(APP_PASSWORD).digest();
  return crypto.timingSafeEqual(given, expected);
}

function sessionCookieOptions(req) {
  return { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' };
}

app.get('/api/session', (req, res) => {
  res.json({ authRequired: !!APP_PASSWORD, authenticated: isAuthenticated(req) });
});

app.post('/api/login', (req, res) => {
  if (!APP_PASSWORD) return res.json({ ok: true });

  const now = Date.now();
  const failures = loginFailures.get(req.ip);
  if (failures && failures.resetAt > now && failures.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const { password } = req.body;
  if (typeof password !== 'string' || !passwordMatches(password)) {
    if (failures && failures.resetAt > now) {
      failures.count++;
    } else {
      if (loginFailures.size > 1000) {
        for (const [ip, entry] of loginFailures) if (entry.resetAt <= now) loginFailures.delete(ip);
      }
      loginFailures.set(req.ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    }
    return res.status(401).json({ error: 'Incorrect password' });
  }

  loginFailures.delete(req.ip);
  res.cookie(SESSION_COOKIE, createSessionToken(), { ...sessionCookieOptions(req), maxAge: SESSION_MAX_AGE_MS });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(req));
  res.json({ ok: true });
});

app.use('/api', (req, res, next) => {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Authentication required', authRequired: true });
});

// --- Plaid (optional) ---

let plaidClient = null;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
  const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
  let basePath = PlaidEnvironments[PLAID_ENV];
  if (!basePath) {
    // Plaid retired its "development" environment; the SDK silently falls back to production
    console.warn(`Unknown PLAID_ENV "${PLAID_ENV}" — using production. Set PLAID_ENV to "sandbox" or "production".`);
    basePath = PlaidEnvironments.production;
  }
  const configuration = new Configuration({
    basePath,
    baseOptions: {
      // Requests run inside the serialized request queue, so never let one hang forever
      timeout: 30000,
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });
  plaidClient = new PlaidApi(configuration);
  console.log(`Plaid configured (env: ${PLAID_ENV})`);
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
  let data;
  try {
    data = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    data = createDefaultData();
    await writeData(data);
    return data;
  }

  let needsWrite = false;

  // --- Migration: old flat format → pools format ---
  if (!data.pools) {
    const pool = {
      id: generateId(),
      name: 'My Budget',
      type: 'spending',
      linkedAccountIds: (data.plaid?.accounts || []).map(a => a.id),
      balance: data.balance || 0,
      buckets: data.buckets || [],
      transactions: data.transactions || [],
      autoAssignRules: data.autoAssignRules || [],
      createdAt: new Date().toISOString(),
    };
    const migrated = { pools: [pool], activePoolId: pool.id };
    // Preserve plaid connection (converted to the multi-item format below)
    if (data.plaid) migrated.plaid = data.plaid;
    data = migrated;
    needsWrite = true;
  }

  // --- Migration: add accumulatedAmount to savings buckets + balanceAccountIds to pools ---
  for (const pool of data.pools) {
    for (const key of ['buckets', 'transactions', 'autoAssignRules', 'linkedAccountIds']) {
      if (!Array.isArray(pool[key])) pool[key] = [];
    }
    if (pool.type === 'savings') {
      for (const bucket of pool.buckets) {
        if (bucket.accumulatedAmount === undefined) {
          bucket.accumulatedAmount = 0;
          needsWrite = true;
        }
      }
    }
    if (!Array.isArray(pool.balanceAccountIds)) {
      pool.balanceAccountIds = [...pool.linkedAccountIds];
      needsWrite = true;
    }
  }

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

  // Always keep at least one pool, and an active pool that exists
  if (data.pools.length === 0) {
    data.pools.push(createPool({ name: 'My Budget', type: 'spending' }));
    needsWrite = true;
  }
  if (!data.pools.some(p => p.id === data.activePoolId)) {
    data.activePoolId = data.pools[0].id;
    needsWrite = true;
  }

  // --- Migration v2: older versions never deducted imported withdrawals in savings pools
  // from their bucket. Flag those so reversing one doesn't refund money never taken out.
  if ((data.schemaVersion || 1) < 2) {
    for (const pool of data.pools) {
      if (pool.type !== 'savings') continue;
      for (const txn of pool.transactions) {
        if (txn.source === 'plaid' && txn.type !== 'deposit' && txn.bucketId) txn.bucketEffect = false;
      }
    }
    data.schemaVersion = SCHEMA_VERSION;
    needsWrite = true;
  }

  if (needsWrite) await writeData(data);
  return data;
}

async function writeData(data) {
  // Write to a temp file and rename it over data.json, so a crash or restart
  // mid-write can never leave a truncated file behind
  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(tmpFile, DATA_FILE);
      return;
    } catch (err) {
      // Windows can briefly lock the target (antivirus, indexers); retry a few times
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
    }
  }
}

// Every route reads data.json, changes it and writes it back. Run them one at a time so
// two overlapping requests can't both start from the same snapshot and lose an update.
let requestQueue = Promise.resolve();
function serialized(handler) {
  return (req, res, next) => {
    const run = requestQueue.then(() => handler(req, res, next));
    requestQueue = run.catch(() => {});
    return run;
  };
}

function sendServerError(res, err, message) {
  console.error(`${message}:`, err.response?.data || err);
  res.status(500).json({ error: message });
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function createPool({ name, type, linkedAccountIds = [], balanceAccountIds = [] }) {
  return {
    id: generateId(),
    name,
    type,
    linkedAccountIds,
    balanceAccountIds,
    balance: 0,
    buckets: [],
    transactions: [],
    autoAssignRules: [],
    createdAt: new Date().toISOString(),
  };
}

function createDefaultData() {
  const pool = createPool({ name: 'My Budget', type: 'spending' });
  return { schemaVersion: SCHEMA_VERSION, pools: [pool], activePoolId: pool.id };
}

function getPool(data, poolId) {
  return data.pools.find(p => p.id === poolId);
}

function sanitizeIdList(ids) {
  return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string' && id))] : [];
}

function getTotalAllocated(buckets) {
  return buckets.reduce((sum, b) => sum + (b.allocatedAmount || 0), 0);
}

function getTotalPercentage(buckets) {
  return buckets.reduce((sum, b) => sum + (b.percentage || 0), 0);
}

function hasBucket(pool, bucketId) {
  return !!bucketId && pool.buckets.some(b => b.id === bucketId);
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isValidColor(color) {
  return typeof color === 'string' && COLOR_PATTERN.test(color);
}

// Turns a client date ('YYYY-MM-DD' or ISO) into an ISO timestamp; now when omitted,
// null when it can't be parsed
function parseDateInput(value) {
  if (value === undefined || value === null || value === '') return new Date().toISOString();
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Picks the rule for a vendor: case-insensitive substring match where the longest pattern
// wins, so "amazon prime" beats "amazon". Rules whose bucket was deleted are ignored.
function findAutoAssignRule(pool, vendorName) {
  const vendorLower = (vendorName || '').trim().toLowerCase();
  if (!vendorLower) return null;
  let best = null;
  for (const rule of pool.autoAssignRules) {
    if (!vendorLower.includes(rule.pattern) || !hasBucket(pool, rule.bucketId)) continue;
    if (!best || rule.pattern.length > best.pattern.length) best = rule;
  }
  return best;
}

// Applies (sign = 1) or reverses (sign = -1) a transaction's effect on its pool's balance
// and buckets. Every create/delete/assign/sync path goes through here, so reversing a
// transaction always undoes exactly what applying it did.
function applyTxnEffect(pool, txn, sign) {
  if (txn.type === 'deposit') {
    pool.balance = roundMoney(pool.balance + sign * txn.amount);
    for (const alloc of txn.allocations || []) {
      const bucket = pool.buckets.find(b => b.id === alloc.bucketId);
      if (bucket) bucket.accumulatedAmount = roundMoney((bucket.accumulatedAmount || 0) + sign * alloc.amount);
    }
    return;
  }

  pool.balance = roundMoney(pool.balance - sign * txn.amount);
  if (!txn.bucketId || txn.bucketEffect === false) return;
  const bucket = pool.buckets.find(b => b.id === txn.bucketId);
  if (!bucket) return;
  if (pool.type === 'savings') {
    bucket.accumulatedAmount = roundMoney((bucket.accumulatedAmount || 0) - sign * txn.amount);
  } else {
    bucket.allocatedAmount = roundMoney((bucket.allocatedAmount || 0) - sign * txn.amount);
  }
}

// Moves an expense into a bucket (refunding the bucket it was in, if any)
function assignTxnToBucket(pool, txn, bucketId) {
  applyTxnEffect(pool, txn, -1);
  txn.bucketId = bucketId;
  delete txn.bucketEffect;
  applyTxnEffect(pool, txn, 1);
}

// Undo any existing income allocation(s) on a transaction so re-marking is idempotent
function undoIncomeAllocations(data, txn) {
  const existingAllocs = [];
  if (txn.incomeAllocation) existingAllocs.push(txn.incomeAllocation);
  if (Array.isArray(txn.incomeAllocations)) existingAllocs.push(...txn.incomeAllocations);
  for (const prev of existingAllocs) {
    const prevPool = data.pools.find(p => p.id === prev.targetPoolId);
    const prevBucket = prevPool?.buckets.find(b => b.id === prev.targetBucketId);
    if (prevBucket && typeof prevBucket.targetAmount === 'number') {
      prevBucket.targetAmount = Math.round((prevBucket.targetAmount - prev.amount) * 100) / 100;
      if (prevBucket.targetAmount < 0) prevBucket.targetAmount = 0;
    }
  }
  delete txn.incomeAllocation;
  delete txn.incomeAllocations;
}

// Take a transfer-in's fills back out of the tax buckets they went into
function undoTransferIn(pool, txn) {
  for (const fill of txn.transferInAllocation?.fills || []) {
    const bucket = pool.buckets.find(b => b.id === fill.bucketId);
    if (bucket) bucket.allocatedAmount = roundMoney((bucket.allocatedAmount || 0) - fill.amount);
  }
  delete txn.transferInAllocation;
}

// Undo everything a transaction did — including income and transfer-in tagging — so it
// can be removed without leaving money or inflated targets behind
function removeTxnEffects(data, pool, txn) {
  undoIncomeAllocations(data, txn);
  undoTransferIn(pool, txn);
  applyTxnEffect(pool, txn, -1);
}

function toStoredAccount(a) {
  return {
    id: a.account_id, name: a.name, officialName: a.official_name,
    type: a.type, subtype: a.subtype, mask: a.mask,
  };
}

function publicPlaidItem(item) {
  return {
    itemId: item.itemId,
    institutionName: item.institutionName || null,
    accounts: item.accounts || [],
    error: item.error?.message || null,
    needsReauth: !!item.error?.needsReauth,
  };
}

function stripPlaidToken(data) {
  const response = { ...data };
  if (data.plaid) {
    const items = data.plaid.items || [];
    response.plaid = {
      linked: items.length > 0,
      items: items.map(publicPlaidItem),
      accounts: items.flatMap(item => item.accounts || []),
      lastSynced: data.plaid.lastSynced,
    };
  }
  return response;
}

// Errors that Plaid Link's update mode can fix by having the user log in again
const REAUTH_ERROR_CODES = new Set([
  'ITEM_LOGIN_REQUIRED', 'ITEM_LOCKED', 'USER_SETUP_REQUIRED', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT',
]);

function recordItemError(item, err) {
  const plaidError = err.response?.data || {};
  item.error = {
    code: plaidError.error_code || 'UNKNOWN',
    message: plaidError.display_message || plaidError.error_message || err.message,
    needsReauth: REAUTH_ERROR_CODES.has(plaidError.error_code),
    at: new Date().toISOString(),
  };
  console.error(`Plaid error for item ${item.itemId}:`, plaidError.error_code ? plaidError : err.message);
  return {
    itemId: item.itemId,
    institutionName: item.institutionName || null,
    error: item.error.message,
    needsReauth: item.error.needsReauth,
  };
}

// Plaid reports each transaction once, and sync skips accounts that feed no pool. When an
// account starts feeding a pool, rewind its item's cursor so the next sync imports that
// account's history (transactions already imported or deleted are skipped by ID).
function rewindCursorsForNewAccounts(data, previouslyLinked) {
  const nowLinked = new Set(data.pools.flatMap(p => p.linkedAccountIds));
  for (const item of data.plaid?.items || []) {
    if ((item.accounts || []).some(a => nowLinked.has(a.id) && !previouslyLinked.has(a.id))) {
      item.transactionsCursor = '';
    }
  }
}

// --- Routes ---

// Get full state
app.get('/api/data', serialized(async (req, res) => {
  try {
    const data = await readData();
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to read data');
  }
}));

// --- Pool CRUD ---

// Create pool
app.post('/api/pools', serialized(async (req, res) => {
  try {
    const { name, type, linkedAccountIds, balanceAccountIds } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!['spending', 'savings', 'goal-savings'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "spending", "savings", or "goal-savings"' });
    }

    const data = await readData();
    const previouslyLinked = new Set(data.pools.flatMap(p => p.linkedAccountIds));
    const linked = sanitizeIdList(linkedAccountIds);
    const balance = Array.isArray(balanceAccountIds)
      ? sanitizeIdList(balanceAccountIds).filter(id => linked.includes(id))
      : [...linked];
    const pool = createPool({ name: name.trim(), type, linkedAccountIds: linked, balanceAccountIds: balance });

    data.pools.push(pool);
    data.activePoolId = pool.id;
    rewindCursorsForNewAccounts(data, previouslyLinked);
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to create pool');
  }
}));

// Update pool
app.put('/api/pools/:poolId', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const previouslyLinked = new Set(data.pools.flatMap(p => p.linkedAccountIds));
    const { name, linkedAccountIds, balanceAccountIds } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      pool.name = name.trim();
    }
    if (linkedAccountIds !== undefined) {
      pool.linkedAccountIds = sanitizeIdList(linkedAccountIds);
      // Drop balance-account references that are no longer linked
      pool.balanceAccountIds = (pool.balanceAccountIds || []).filter(id => pool.linkedAccountIds.includes(id));
    }
    if (balanceAccountIds !== undefined) {
      pool.balanceAccountIds = sanitizeIdList(balanceAccountIds).filter(id => pool.linkedAccountIds.includes(id));
    }

    rewindCursorsForNewAccounts(data, previouslyLinked);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to update pool');
  }
}));

// Delete pool
app.delete('/api/pools/:poolId', serialized(async (req, res) => {
  try {
    const data = await readData();
    const idx = data.pools.findIndex(p => p.id === req.params.poolId);
    if (idx === -1) return res.status(404).json({ error: 'Pool not found' });
    if (data.pools.length === 1) {
      return res.status(400).json({ error: "You can't delete your only pool" });
    }

    // Income tagging on this pool's transactions raised tax targets in other pools
    for (const txn of data.pools[idx].transactions) undoIncomeAllocations(data, txn);

    data.pools.splice(idx, 1);
    if (data.activePoolId === req.params.poolId) {
      data.activePoolId = data.pools[0].id;
    }
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to delete pool');
  }
}));

// Set active pool
app.put('/api/pools/:poolId/active', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    data.activePoolId = pool.id;
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to set active pool');
  }
}));

// --- Pool-scoped routes ---

// Update balance for a pool
app.put('/api/pools/:poolId/balance', serialized(async (req, res) => {
  try {
    // Negative is allowed: an overdrawn account, or a pool whose card debt exceeds its cash
    const { balance } = req.body;
    if (typeof balance !== 'number' || !Number.isFinite(balance)) {
      return res.status(400).json({ error: 'Balance must be a number' });
    }
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    pool.balance = roundMoney(balance);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to update balance');
  }
}));

// Log a deposit to a savings pool (income-aware allocation)
app.post('/api/pools/:poolId/deposit', serialized(async (req, res) => {
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
    const txnDate = parseDateInput(date);
    if (!txnDate) return res.status(400).json({ error: 'Invalid date' });

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    if (pool.type !== 'savings') {
      return res.status(400).json({ error: 'Deposits are only for savings pools' });
    }

    let remaining = roundMoney(depositAmount);
    const allocations = [];

    // Priority-based filling: buckets fill in array order
    for (const bucket of pool.buckets) {
      if (remaining <= 0) break;
      const need = Math.round(checkTotal * (bucket.percentage || 0)) / 100;
      const allocated = roundMoney(Math.min(need, remaining));
      if (allocated > 0) {
        remaining = roundMoney(remaining - allocated);
        allocations.push({ bucketId: bucket.id, amount: allocated });
      }
    }

    const transaction = {
      id: generateId(),
      type: 'deposit',
      vendor: 'Deposit',
      amount: roundMoney(depositAmount),
      checkTotal: roundMoney(checkTotal),
      allocations,
      bucketId: null,
      note: typeof note === 'string' ? note.trim() : '',
      date: txnDate,
      createdAt: new Date().toISOString(),
    };

    applyTxnEffect(pool, transaction, 1);
    pool.transactions.push(transaction);
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to log deposit');
  }
}));

// Create bucket in pool
app.post('/api/pools/:poolId/buckets', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (color !== undefined && !isValidColor(color)) {
      return res.status(400).json({ error: 'Color must be a hex value like #4F46E5' });
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
      // Dollar-based bucket (spending / goal-savings)
      const { targetAmount, allocatedAmount, isTax } = req.body;
      if (typeof targetAmount !== 'number' || targetAmount < 0) {
        return res.status(400).json({ error: 'Target amount must be a non-negative number' });
      }
      const alloc = typeof allocatedAmount === 'number' ? roundMoney(allocatedAmount) : 0;
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
        targetAmount: roundMoney(targetAmount),
        allocatedAmount: alloc,
        color: color || '#4F46E5',
        isTax: !!isTax,
        createdAt: new Date().toISOString(),
      });
    }

    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to create bucket');
  }
}));

// Update bucket in pool
app.put('/api/pools/:poolId/buckets/:id', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const bucket = pool.buckets.find(b => b.id === req.params.id);
    if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

    const { name, color } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      bucket.name = name.trim();
    }
    if (color !== undefined) {
      if (!isValidColor(color)) {
        return res.status(400).json({ error: 'Color must be a hex value like #4F46E5' });
      }
      bucket.color = color;
    }

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
      const { targetAmount, allocatedAmount, isTax } = req.body;
      if (targetAmount !== undefined) {
        if (typeof targetAmount !== 'number' || targetAmount < 0) {
          return res.status(400).json({ error: 'Target amount must be a non-negative number' });
        }
        bucket.targetAmount = roundMoney(targetAmount);
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
        bucket.allocatedAmount = roundMoney(allocatedAmount);
      }
      if (isTax !== undefined) {
        bucket.isTax = !!isTax;
      }
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to update bucket');
  }
}));

// Delete bucket from pool
app.delete('/api/pools/:poolId/buckets/:id', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.buckets.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Bucket not found' });
    pool.buckets.splice(idx, 1);
    // Rules pointing at the bucket would otherwise keep sorting imports into nowhere
    pool.autoAssignRules = pool.autoAssignRules.filter(r => r.bucketId !== req.params.id);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to delete bucket');
  }
}));

// Transfer money between buckets (spending pools only)
app.post('/api/pools/:poolId/buckets/transfer', serialized(async (req, res) => {
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
        b.allocatedAmount = roundMoney(b.allocatedAmount);
      }
    });

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to transfer funds');
  }
}));

// --- Transaction Routes (pool-scoped) ---

// Log a purchase
app.post('/api/pools/:poolId/transactions', serialized(async (req, res) => {
  try {
    const { vendor, amount, bucketId, note, date } = req.body;

    if (!vendor || typeof vendor !== 'string' || !vendor.trim()) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    const txnDate = parseDateInput(date);
    if (!txnDate) return res.status(400).json({ error: 'Invalid date' });

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    if (pool.type === 'spending' || pool.type === 'goal-savings') {
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
    } else {
      // Savings: the bucket is optional, but it has to exist if one was picked
      if (bucketId && !hasBucket(pool, bucketId)) {
        return res.status(404).json({ error: 'Bucket not found' });
      }
      if (amount > pool.balance) {
        return res.status(400).json({
          error: `Insufficient balance. Available: $${pool.balance.toFixed(2)}`
        });
      }
    }

    const transaction = {
      id: generateId(),
      vendor: vendor.trim(),
      amount: roundMoney(amount),
      bucketId: bucketId || null,
      note: typeof note === 'string' ? note.trim() : '',
      date: txnDate,
      createdAt: new Date().toISOString(),
    };

    applyTxnEffect(pool, transaction, 1);
    pool.transactions.push(transaction);
    await writeData(data);
    res.status(201).json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to log transaction');
  }
}));

// Delete a transaction (refunds a purchase, takes back a deposit, and undoes any tagging)
app.delete('/api/pools/:poolId/transactions/:id', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const idx = pool.transactions.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

    removeTxnEffects(data, pool, pool.transactions[idx]);
    pool.transactions.splice(idx, 1);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to delete transaction');
  }
}));

// Assign a transaction to a bucket (or move it to a different one)
app.put('/api/pools/:poolId/transactions/:id/assign', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const txn = pool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.type === 'deposit') {
      return res.status(400).json({ error: "Deposits can't be assigned to a bucket" });
    }

    const { bucketId } = req.body;
    if (!hasBucket(pool, bucketId)) return res.status(404).json({ error: 'Bucket not found' });

    if (txn.bucketId !== bucketId) {
      assignTxnToBucket(pool, txn, bucketId);
      await writeData(data);
    }
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to assign transaction');
  }
}));

// Mark a transaction as income with a split across multiple buckets
app.post('/api/pools/:poolId/transactions/:id/mark-income-split', serialized(async (req, res) => {
  try {
    const data = await readData();
    const sourcePool = getPool(data, req.params.poolId);
    if (!sourcePool) return res.status(404).json({ error: 'Pool not found' });

    const txn = sourcePool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const { splits } = req.body;
    if (!Array.isArray(splits)) {
      return res.status(400).json({ error: 'splits must be an array' });
    }

    const total = Math.round(txn.amount * 100) / 100;
    let sum = 0;
    for (const s of splits) {
      if (!s || typeof s.amount !== 'number' || s.amount <= 0) {
        return res.status(400).json({ error: 'Each split amount must be a positive number' });
      }
      sum = Math.round((sum + s.amount) * 100) / 100;
      const targetPool = getPool(data, s.targetPoolId);
      if (!targetPool) return res.status(404).json({ error: 'Target pool not found' });
      const targetBucket = targetPool.buckets.find(b => b.id === s.targetBucketId);
      if (!targetBucket) return res.status(404).json({ error: 'Target bucket not found' });
      if (!targetBucket.isTax) {
        return res.status(400).json({ error: `"${targetBucket.name}" is not a tax bucket` });
      }
      if (typeof targetBucket.targetAmount !== 'number') {
        return res.status(400).json({ error: `"${targetBucket.name}" is not target-based` });
      }
    }
    if (sum > total + 0.005) {
      return res.status(400).json({ error: `Splits ($${sum.toFixed(2)}) exceed transaction total ($${total.toFixed(2)})` });
    }

    undoIncomeAllocations(data, txn);

    const applied = [];
    for (const s of splits) {
      const rounded = Math.round(s.amount * 100) / 100;
      const targetPool = getPool(data, s.targetPoolId);
      const targetBucket = targetPool.buckets.find(b => b.id === s.targetBucketId);
      targetBucket.targetAmount = Math.round((targetBucket.targetAmount + rounded) * 100) / 100;
      applied.push({ targetPoolId: s.targetPoolId, targetBucketId: s.targetBucketId, amount: rounded });
    }

    if (applied.length > 0) {
      txn.incomeAllocations = applied;
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to mark transaction as income');
  }
}));

// Mark a transaction as income: grows target of a goal-savings bucket by a user-chosen amount
app.post('/api/pools/:poolId/transactions/:id/mark-income', serialized(async (req, res) => {
  try {
    const data = await readData();
    const sourcePool = getPool(data, req.params.poolId);
    if (!sourcePool) return res.status(404).json({ error: 'Pool not found' });

    const txn = sourcePool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const { targetPoolId, targetBucketId, amount } = req.body;
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Amount must be a non-negative number' });
    }

    const targetPool = getPool(data, targetPoolId);
    if (!targetPool) return res.status(404).json({ error: 'Target pool not found' });
    if (targetPool.type !== 'goal-savings') {
      return res.status(400).json({ error: 'Target pool must be a goal-savings pool' });
    }
    const targetBucket = targetPool.buckets.find(b => b.id === targetBucketId);
    if (!targetBucket) return res.status(404).json({ error: 'Target bucket not found' });
    if (typeof targetBucket.targetAmount !== 'number') {
      return res.status(400).json({ error: 'Target bucket is not a target-based bucket' });
    }
    if (!targetBucket.isTax) {
      return res.status(400).json({ error: 'Target bucket must be a tax bucket' });
    }

    // Idempotency: undo any previous income tagging (single or split) first
    undoIncomeAllocations(data, txn);

    const rounded = Math.round(amount * 100) / 100;
    targetBucket.targetAmount = Math.round((targetBucket.targetAmount + rounded) * 100) / 100;
    txn.incomeAllocation = {
      targetPoolId,
      targetBucketId,
      amount: rounded,
    };

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to mark transaction as income');
  }
}));

// Mark a transaction as transfer-in: fills the transaction's pool buckets in creation order
app.post('/api/pools/:poolId/transactions/:id/mark-transfer-in', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    if (pool.type !== 'goal-savings') {
      return res.status(400).json({ error: 'Transfer-in is only available on goal-savings pools' });
    }

    const txn = pool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.transferInAllocation) {
      return res.status(409).json({ error: 'Transaction is already marked as transfer-in' });
    }

    let remaining = Math.round(txn.amount * 100) / 100;
    const fills = [];
    for (const bucket of pool.buckets) {
      if (remaining <= 0) break;
      if (!bucket.isTax) continue;
      if (typeof bucket.targetAmount !== 'number') continue;
      const unfilled = Math.max(0, Math.round((bucket.targetAmount - (bucket.allocatedAmount || 0)) * 100) / 100);
      if (unfilled <= 0) continue;
      const fill = Math.min(remaining, unfilled);
      bucket.allocatedAmount = Math.round(((bucket.allocatedAmount || 0) + fill) * 100) / 100;
      remaining = Math.round((remaining - fill) * 100) / 100;
      fills.push({ bucketId: bucket.id, bucketName: bucket.name, amount: fill });
    }

    txn.transferInAllocation = {
      fills,
      unallocated: Math.round(remaining * 100) / 100,
    };

    await writeData(data);
    const response = stripPlaidToken(data);
    response.transferInSummary = txn.transferInAllocation;
    res.json(response);
  } catch (err) {
    sendServerError(res, err, 'Failed to mark transaction as transfer-in');
  }
}));

// Undo a transfer-in: take the filled amounts back out of the tax buckets
app.delete('/api/pools/:poolId/transactions/:id/transfer-in', serialized(async (req, res) => {
  try {
    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const txn = pool.transactions.find(t => t.id === req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (!txn.transferInAllocation) {
      return res.status(400).json({ error: 'Transaction is not marked as transfer-in' });
    }

    undoTransferIn(pool, txn);
    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to undo transfer-in');
  }
}));

// --- Auto-Assign Rule Routes (pool-scoped) ---

app.post('/api/pools/:poolId/auto-assign-rules', serialized(async (req, res) => {
  try {
    const { pattern, bucketId, applyToExisting } = req.body;
    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const data = await readData();
    const pool = getPool(data, req.params.poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    if (!hasBucket(pool, bucketId)) {
      return res.status(404).json({ error: 'Bucket not found' });
    }

    const normalized = pattern.trim().toLowerCase();
    if (pool.autoAssignRules.find(r => r.pattern === normalized)) {
      return res.status(400).json({ error: 'A rule for this pattern already exists' });
    }

    const rule = {
      id: generateId(),
      pattern: normalized,
      bucketId,
      createdAt: new Date().toISOString(),
    };
    pool.autoAssignRules.push(rule);

    // Optionally sort uncategorized expenses this rule now matches best
    let appliedCount = 0;
    if (applyToExisting) {
      for (const txn of pool.transactions) {
        if (txn.type === 'deposit' || hasBucket(pool, txn.bucketId)) continue;
        if (findAutoAssignRule(pool, txn.vendor) !== rule) continue;
        assignTxnToBucket(pool, txn, rule.bucketId);
        appliedCount++;
      }
    }

    await writeData(data);
    const response = stripPlaidToken(data);
    response.appliedCount = appliedCount;
    res.status(201).json(response);
  } catch (err) {
    sendServerError(res, err, 'Failed to create rule');
  }
}));

app.delete('/api/pools/:poolId/auto-assign-rules/:id', serialized(async (req, res) => {
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
    sendServerError(res, err, 'Failed to delete rule');
  }
}));

// --- Plaid Routes ---

app.get('/api/plaid/status', serialized(async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    res.json({
      configured: !!plaidClient,
      linked: items.length > 0,
      items: items.map(publicPlaidItem),
      accounts: items.flatMap(item => item.accounts || []),
      sandbox: PLAID_ENV === 'sandbox',
    });
  } catch (err) {
    sendServerError(res, err, 'Failed to read Plaid status');
  }
}));

// Create a Link token. With { itemId } it's an update-mode token that re-authenticates an
// existing connection (e.g. after ITEM_LOGIN_REQUIRED) instead of adding a new one.
app.post('/api/plaid/create_link_token', requirePlaid, serialized(async (req, res) => {
  try {
    const host = req.headers.origin || `http://localhost:${PORT}`;
    const request = {
      user: { client_user_id: 'local-user' },
      client_name: 'Bucket Budget',
      country_codes: ['US'],
      language: 'en',
      redirect_uri: process.env.PLAID_REDIRECT_URI || `${host}/plaid-oauth-return.html`,
    };

    const { itemId } = req.body;
    if (itemId) {
      const data = await readData();
      const item = (data.plaid?.items || []).find(i => i.itemId === itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      request.access_token = item.accessToken;
    } else {
      request.products = ['transactions'];
    }

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid linkTokenCreate error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
}));

// Store a newly linked item. Linking the same item again refreshes it instead of duplicating it.
async function saveLinkedItem({ accessToken, itemId, institutionName }) {
  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = accountsResponse.data.accounts.map(toStoredAccount);

  const data = await readData();
  if (!data.plaid) data.plaid = { items: [], lastSynced: null };
  if (!data.plaid.items) data.plaid.items = [];

  const existing = data.plaid.items.find(i => i.itemId === itemId);
  if (existing) {
    existing.accessToken = accessToken;
    existing.accounts = accounts;
    if (institutionName) existing.institutionName = institutionName;
    delete existing.error;
  } else {
    data.plaid.items.push({
      accessToken, itemId, institutionName: institutionName || null, accounts,
      transactionsCursor: '', syncedPlaidTxnIds: [],
    });
  }
  await writeData(data);

  return { linked: true, accounts: data.plaid.items.flatMap(i => i.accounts || []), itemId };
}

app.post('/api/plaid/exchange_token', requirePlaid, serialized(async (req, res) => {
  try {
    const { public_token, institutionName, metadata } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;
    const name = typeof institutionName === 'string' ? institutionName : metadata?.institution?.name;

    res.json(await saveLinkedItem({
      accessToken: access_token,
      itemId: item_id,
      institutionName: typeof name === 'string' ? name.trim().slice(0, 100) : null,
    }));
  } catch (err) {
    console.error('Plaid exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
}));

app.post('/api/plaid/sandbox_setup', requirePlaid, serialized(async (req, res) => {
  try {
    if (PLAID_ENV !== 'sandbox') {
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

    res.json(await saveLinkedItem({
      accessToken: access_token, itemId: item_id, institutionName: 'First Platypus Bank (Sandbox)',
    }));
  } catch (err) {
    console.error('Sandbox setup error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to set up sandbox accounts' });
  }
}));

// After Link update mode succeeds, confirm the item works again and clear its error
app.post('/api/plaid/items/:itemId/reconnected', requirePlaid, serialized(async (req, res) => {
  try {
    const data = await readData();
    const item = (data.plaid?.items || []).find(i => i.itemId === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    try {
      const accountsResponse = await plaidClient.accountsGet({ access_token: item.accessToken });
      item.accounts = accountsResponse.data.accounts.map(toStoredAccount);
      delete item.error;
    } catch (err) {
      const failure = recordItemError(item, err);
      await writeData(data);
      return res.status(400).json({ error: `Still can't reach ${failure.institutionName || 'this bank'}: ${failure.error}` });
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to refresh bank connection');
  }
}));

app.get('/api/plaid/accounts', requirePlaid, serialized(async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No bank account linked' });
    }
    const allAccounts = items.flatMap(i => i.accounts || []);
    res.json({ accounts: allAccounts });
  } catch (err) {
    sendServerError(res, err, 'Failed to get accounts');
  }
}));

// Credit cards and loans report money owed, which counts against a pool's balance
const DEBT_ACCOUNT_TYPES = new Set(['credit', 'loan']);

// Sync balance — updates each pool based on its balance accounts
app.post('/api/plaid/sync_balance', requirePlaid, serialized(async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No bank account linked' });
    }

    // Fetch balances item by item, so one broken connection doesn't block the rest
    const plaidAccounts = new Map();
    const unavailableAccountIds = new Set();
    const failedItems = [];
    for (const item of items) {
      try {
        const balanceResponse = await plaidClient.accountsGet({ access_token: item.accessToken });
        for (const acct of balanceResponse.data.accounts) plaidAccounts.set(acct.account_id, acct);
        // Update account metadata for this item
        item.accounts = balanceResponse.data.accounts.map(toStoredAccount);
        delete item.error;
      } catch (err) {
        failedItems.push(recordItemError(item, err));
        for (const acct of item.accounts || []) unavailableAccountIds.add(acct.id);
      }
    }

    // A pool that counts an account we couldn't fetch keeps its previous balance rather than
    // dropping that account's money. Accounts that no longer exist are ignored, and a pool
    // with none of its accounts left is skipped instead of being zeroed.
    let updatedPools = 0;
    for (const pool of data.pools) {
      const balanceIds = pool.balanceAccountIds || [];
      if (balanceIds.some(id => unavailableAccountIds.has(id))) continue;
      const accounts = balanceIds.map(id => plaidAccounts.get(id)).filter(Boolean);
      if (accounts.length === 0) continue;
      const total = accounts.reduce((sum, acct) => {
        const current = acct.balances?.current || 0;
        return sum + (DEBT_ACCOUNT_TYPES.has(acct.type) ? -current : current);
      }, 0);
      pool.balance = roundMoney(total);
      updatedPools++;
    }

    if (failedItems.length < items.length) data.plaid.lastSynced = new Date().toISOString();
    await writeData(data);
    const response = stripPlaidToken(data);
    response.balanceSummary = { updatedPools, failedItems };
    res.json(response);
  } catch (err) {
    sendServerError(res, err, 'Failed to sync balance from bank');
  }
}));

// Pages through /transactions/sync from the item's saved cursor. If Plaid reports that data
// changed mid-pagination, restart from the saved cursor as Plaid recommends.
async function fetchTransactionChanges(item) {
  for (let attempt = 1; ; attempt++) {
    const changes = { added: [], modified: [], removed: [], cursor: item.transactionsCursor || '' };
    try {
      let hasMore = true;
      while (hasMore) {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor: changes.cursor, count: 500,
        });
        changes.added.push(...syncResponse.data.added);
        changes.modified.push(...syncResponse.data.modified);
        changes.removed.push(...syncResponse.data.removed);
        hasMore = syncResponse.data.has_more;
        changes.cursor = syncResponse.data.next_cursor;
      }
      return changes;
    } catch (err) {
      const restartable = err.response?.data?.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION';
      if (!restartable || attempt >= 3) throw err;
    }
  }
}

// Applies Plaid's latest version of an already-imported transaction. The user's bucket choice
// is kept; a rule only fills in a bucket when the transaction doesn't have one.
// Returns false when nothing we track changed.
function updateImportedTxn(pool, txn, plaidTxn) {
  const isDeposit = plaidTxn.amount < 0;
  const amount = roundMoney(Math.abs(plaidTxn.amount));
  const vendor = plaidTxn.merchant_name || plaidTxn.name || txn.vendor;
  const date = new Date(plaidTxn.date).toISOString();
  if (amount === txn.amount && vendor === txn.vendor && date === txn.date && isDeposit === (txn.type === 'deposit')) {
    return false;
  }

  applyTxnEffect(pool, txn, -1);
  let bucketId = null;
  if (!isDeposit) {
    bucketId = hasBucket(pool, txn.bucketId)
      ? txn.bucketId
      : (findAutoAssignRule(pool, vendor)?.bucketId || txn.bucketId || null);
  }
  if (bucketId !== txn.bucketId) delete txn.bucketEffect;

  txn.vendor = vendor;
  txn.amount = amount;
  txn.bucketId = bucketId;
  txn.date = date;
  if (isDeposit) txn.type = 'deposit';
  else delete txn.type;
  applyTxnEffect(pool, txn, 1);
  return true;
}

// Sync transactions — routes to correct pool by account
app.post('/api/plaid/sync_transactions', requirePlaid, serialized(async (req, res) => {
  try {
    const data = await readData();
    const items = data.plaid?.items || [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No account linked' });
    }

    // Every imported transaction by Plaid ID, and every Plaid ID ever imported (which
    // includes ones the user deleted, so those never come back)
    const imported = new Map();
    for (const pool of data.pools) {
      for (const txn of pool.transactions) {
        if (txn.plaidTransactionId) imported.set(txn.plaidTransactionId, { pool, txn });
      }
    }
    const syncedIds = new Set(items.flatMap(i => i.syncedPlaidTxnIds || []));

    // uncategorized counts only expenses — deposits can't be assigned to a bucket
    const summary = { added: 0, modified: 0, removed: 0, autoAssigned: 0, uncategorized: 0 };
    const failedItems = [];

    for (const item of items) {
      // A failing item (e.g. an expired bank login) is reported but doesn't stop the others
      let changes;
      try {
        changes = await fetchTransactionChanges(item);
      } catch (err) {
        failedItems.push(recordItemError(item, err));
        continue;
      }
      item.transactionsCursor = changes.cursor;
      delete item.error;

      // --- Removals: undo everything the transaction did, then drop it ---
      for (const { transaction_id } of changes.removed) {
        const found = imported.get(transaction_id);
        if (found) {
          removeTxnEffects(data, found.pool, found.txn);
          found.pool.transactions.splice(found.pool.transactions.indexOf(found.txn), 1);
          imported.delete(transaction_id);
          summary.removed++;
        }
        const syncedIdx = item.syncedPlaidTxnIds.indexOf(transaction_id);
        if (syncedIdx !== -1) item.syncedPlaidTxnIds.splice(syncedIdx, 1);
        syncedIds.delete(transaction_id);
      }

      // --- Additions and modifications ---
      // After a cursor rewind Plaid re-sends already-imported transactions as "added";
      // those are treated as possible modifications rather than imported twice.
      for (const plaidTxn of [...changes.added, ...changes.modified]) {
        if (plaidTxn.pending) continue;

        const found = imported.get(plaidTxn.transaction_id);
        if (found) {
          if (updateImportedTxn(found.pool, found.txn, plaidTxn)) summary.modified++;
          // Re-record it in case reset_cursor cleared the list, so a later delete sticks
          if (!syncedIds.has(plaidTxn.transaction_id)) {
            item.syncedPlaidTxnIds.push(plaidTxn.transaction_id);
            syncedIds.add(plaidTxn.transaction_id);
          }
          continue;
        }
        if (syncedIds.has(plaidTxn.transaction_id)) continue; // deleted by the user

        const pool = data.pools.find(p => p.linkedAccountIds.includes(plaidTxn.account_id));
        if (!pool) continue; // Skip transactions for accounts no pool uses

        // Plaid sign convention: positive = money out (expense), negative = money in (deposit)
        const isDeposit = plaidTxn.amount < 0;
        const vendor = plaidTxn.merchant_name || plaidTxn.name || 'Unknown';
        // Only auto-assign expenses; deposits stay uncategorized (user can Mark Transfer-In etc.)
        const matchedRule = isDeposit ? null : findAutoAssignRule(pool, vendor);
        if (matchedRule) summary.autoAssigned++;
        else if (!isDeposit) summary.uncategorized++;

        const txn = {
          id: generateId(),
          vendor,
          amount: roundMoney(Math.abs(plaidTxn.amount)),
          bucketId: matchedRule ? matchedRule.bucketId : null,
          note: '',
          date: new Date(plaidTxn.date).toISOString(),
          createdAt: new Date().toISOString(),
          plaidTransactionId: plaidTxn.transaction_id,
          source: 'plaid',
          plaidAccountId: plaidTxn.account_id,
        };
        if (isDeposit) txn.type = 'deposit';

        applyTxnEffect(pool, txn, 1);
        pool.transactions.push(txn);
        imported.set(plaidTxn.transaction_id, { pool, txn });
        item.syncedPlaidTxnIds.push(plaidTxn.transaction_id);
        syncedIds.add(plaidTxn.transaction_id);
        summary.added++;
      }
    }

    if (failedItems.length < items.length) data.plaid.lastSynced = new Date().toISOString();
    await writeData(data);

    const response = stripPlaidToken(data);
    response.syncSummary = { ...summary, failedItems };
    res.json(response);
  } catch (err) {
    sendServerError(res, err, 'Failed to sync transactions from bank');
  }
}));

// Reset a Plaid item's transactions cursor so the next sync re-imports history
app.post('/api/plaid/reset_cursor', requirePlaid, serialized(async (req, res) => {
  try {
    const { itemId } = req.body;
    const data = await readData();
    const items = data.plaid?.items || [];
    const target = itemId ? items.filter(i => i.itemId === itemId) : items;
    if (target.length === 0) {
      return res.status(404).json({ error: 'No matching Plaid item found' });
    }
    for (const item of target) {
      item.transactionsCursor = '';
      item.syncedPlaidTxnIds = [];
    }
    await writeData(data);
    res.json({ reset: target.map(t => t.itemId) });
  } catch (err) {
    sendServerError(res, err, 'Failed to reset cursor');
  }
}));

// Disconnect bank account (specific item or all)
app.delete('/api/plaid/disconnect', requirePlaid, serialized(async (req, res) => {
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

      // Remove this item's accounts from every pool's linked and balance accounts
      const removedAccountIds = new Set((item.accounts || []).map(a => a.id));
      for (const pool of data.pools) {
        pool.linkedAccountIds = pool.linkedAccountIds.filter(id => !removedAccountIds.has(id));
        pool.balanceAccountIds = (pool.balanceAccountIds || []).filter(id => !removedAccountIds.has(id));
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
      for (const pool of data.pools) {
        pool.linkedAccountIds = [];
        pool.balanceAccountIds = [];
      }
      if (data.plaid) data.plaid.items = [];
    }

    if (data.plaid && data.plaid.items.length === 0) {
      delete data.plaid;
    }

    await writeData(data);
    res.json(stripPlaidToken(data));
  } catch (err) {
    sendServerError(res, err, 'Failed to disconnect bank account');
  }
}));

// Unknown API routes and malformed bodies answer in JSON, like every other API response
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: 'Something went wrong' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bucket Budget running at http://0.0.0.0:${PORT}`);
  if (!APP_PASSWORD) {
    console.log('No APP_PASSWORD set — anyone who can reach this server can view and change your budget.');
  }
});
