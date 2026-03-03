// --- State ---
let state = { balance: 0, buckets: [] };
let plaidStatus = { configured: false, linked: false, accounts: [], sandbox: false };

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

// --- API Helpers ---

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function fetchState() {
  try {
    state = await api('GET', '/api/data');
    render();
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Formatting ---

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(n);
}

function getTotalAllocated() {
  return state.buckets.reduce((s, b) => s + b.allocatedAmount, 0);
}

function getUnallocated() {
  return state.balance - getTotalAllocated();
}

// --- Rendering ---

function render() {
  renderBalance();
  renderSummaryBar();
  renderBuckets();
  renderPlaidSection();
  renderTransactionHistory();
}

function renderBalance() {
  const totalEl = document.getElementById('total-balance');
  const allocEl = document.getElementById('total-allocated');
  const unallocEl = document.getElementById('unallocated');

  totalEl.textContent = fmt(state.balance);
  allocEl.textContent = fmt(getTotalAllocated());

  const unalloc = getUnallocated();
  unallocEl.textContent = fmt(unalloc);
  unallocEl.className = 'balance-amount ' + (unalloc < 0 ? 'warning' : 'accent');
}

function renderSummaryBar() {
  const bar = document.getElementById('summary-bar');
  bar.innerHTML = '';

  if (state.balance <= 0) return;

  state.buckets.forEach(b => {
    const pct = (b.allocatedAmount / state.balance) * 100;
    if (pct <= 0) return;
    const seg = document.createElement('div');
    seg.className = 'segment';
    seg.style.width = Math.min(pct, 100) + '%';
    seg.style.background = `linear-gradient(to bottom, ${b.color}ee, ${b.color})`;
    seg.title = `${b.name}: ${fmt(b.allocatedAmount)}`;
    bar.appendChild(seg);
  });
}

function renderBuckets() {
  const grid = document.getElementById('bucket-grid');
  const empty = document.getElementById('empty-state');

  if (state.buckets.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = state.buckets.map(b => renderBucketCard(b)).join('');
}

function renderBucketCard(b) {
  const fillPct = b.targetAmount > 0
    ? Math.min((b.allocatedAmount / b.targetAmount) * 100, 150)
    : (b.allocatedAmount > 0 ? 100 : 0);
  const displayPct = b.targetAmount > 0
    ? Math.round((b.allocatedAmount / b.targetAmount) * 100)
    : (b.allocatedAmount > 0 ? 100 : 0);
  const isFull = fillPct >= 100 && fillPct <= 100;
  const isOver = fillPct > 100;

  const visualClass = isOver ? 'over' : (isFull ? 'full' : '');
  const textColor = fillPct > 40 ? 'white' : 'rgba(200,210,230,0.7)';
  const fillColor = isOver ? '#EF4444' : b.color;

  // Create SVG wave (triple layer for depth + counter-wave)
  const waveSvg = fillPct > 0 ? `
    <svg class="bucket-fill-wave" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V16 H0Z" fill="${fillColor}" opacity="0.5"/>
      <path d="M0 10 Q30 4 60 10 T120 10 T180 10 T200 10 V16 H0Z" fill="${fillColor}" opacity="0.3"/>
    </svg>
    <svg class="bucket-fill-wave bucket-fill-wave-reverse" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M200 8 Q175 2 150 8 T100 8 T50 8 T0 8 V16 H200Z" fill="${fillColor}" opacity="0.2"/>
    </svg>
  ` : '';

  return `
    <div class="bucket-card" data-id="${b.id}">
      <div class="bucket-card-header">
        <div class="bucket-name-row">
          <div class="bucket-color-dot" style="background:${b.color}"></div>
          <span class="bucket-name">${escHtml(b.name)}</span>
        </div>
      </div>
      <div class="bucket-amounts">
        <strong>${fmt(b.allocatedAmount)}</strong> / ${fmt(b.targetAmount)}
      </div>
      <div class="bucket-txn-count" onclick="openBucketTransactions('${b.id}')">${(() => { const c = (state.transactions || []).filter(t => t.bucketId === b.id).length; return c === 0 ? 'No transactions' : c + ' transaction' + (c !== 1 ? 's' : ''); })()}</div>
      <div class="bucket-visual-wrapper">
        <div class="bucket-handle"></div>
        <div class="bucket-rim"></div>
        <div class="bucket-visual ${visualClass}">
          <div class="bucket-fill" style="height:${Math.min(fillPct, 100)}%">
            ${waveSvg}
            <div class="bucket-fill-inner" style="background:linear-gradient(to top, ${fillColor}, ${fillColor}dd)"></div>
          </div>
          <span class="bucket-percent" style="color:${textColor}">${displayPct}%</span>
        </div>
      </div>
      <div class="bucket-actions">
        <button class="btn-small" onclick="openLogPurchase('${b.id}')">&#x1F4B8; Spend</button>
        <button class="btn-small" onclick="openEditBucket('${b.id}')">&#x270E; Edit</button>
        <button class="btn-small" onclick="openAddRemove('${b.id}')">&#x00B1; Funds</button>
        <button class="btn-danger" style="padding:0.4rem 0.75rem;font-size:0.75rem" onclick="openDeleteBucket('${b.id}')">&#x2715; Delete</button>
      </div>
    </div>
  `;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- Modal ---

function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// --- Toast ---

function showToast(msg, isError) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Balance ---

function openEditBalance() {
  openModal('Update Balance', `
    <div class="form-group">
      <label for="balance-input">Total Bank Balance</label>
      <input type="number" id="balance-input" step="0.01" min="0" value="${state.balance}" placeholder="0.00">
    </div>
    <div class="form-error" id="balance-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitBalance()">Update</button>
    </div>
  `);
  document.getElementById('balance-input').focus();
  document.getElementById('balance-input').select();
}

async function submitBalance() {
  const val = parseFloat(document.getElementById('balance-input').value);
  if (isNaN(val) || val < 0) {
    document.getElementById('balance-error').textContent = 'Enter a valid non-negative number';
    return;
  }
  try {
    state = await api('PUT', '/api/balance', { balance: Math.round(val * 100) / 100 });
    closeModal();
    render();
    showToast('Balance updated');
  } catch (err) {
    document.getElementById('balance-error').textContent = err.message;
  }
}

// --- Create Bucket ---

function openNewBucket() {
  const colorButtons = COLORS.map((c, i) =>
    `<div class="color-option ${i === 0 ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`
  ).join('');

  openModal('New Bucket', `
    <div class="form-group">
      <label for="bucket-name">Name</label>
      <input type="text" id="bucket-name" placeholder="e.g. Dining Out" maxlength="40">
    </div>
    <div class="form-group">
      <label for="bucket-target">Target Amount</label>
      <input type="number" id="bucket-target" step="0.01" min="0" placeholder="100.00">
    </div>
    <div class="form-group">
      <label for="bucket-alloc">Initial Allocation</label>
      <input type="number" id="bucket-alloc" step="0.01" min="0" value="0" placeholder="0.00">
      <div class="hint">Available: ${fmt(getUnallocated())}</div>
    </div>
    <div class="form-group">
      <label>Color</label>
      <div class="color-options">${colorButtons}</div>
    </div>
    <div class="form-error" id="bucket-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitNewBucket()">Create</button>
    </div>
  `);
  document.getElementById('bucket-name').focus();
}

function selectColor(el) {
  document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function submitNewBucket() {
  const name = document.getElementById('bucket-name').value.trim();
  const target = parseFloat(document.getElementById('bucket-target').value);
  const alloc = parseFloat(document.getElementById('bucket-alloc').value) || 0;
  const color = document.querySelector('.color-option.selected')?.dataset.color || COLORS[0];

  if (!name) {
    document.getElementById('bucket-error').textContent = 'Name is required';
    return;
  }
  if (isNaN(target) || target < 0) {
    document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
    return;
  }

  try {
    state = await api('POST', '/api/buckets', {
      name, targetAmount: Math.round(target * 100) / 100,
      allocatedAmount: Math.round(alloc * 100) / 100, color,
    });
    closeModal();
    render();
    showToast(`"${name}" created`);
  } catch (err) {
    document.getElementById('bucket-error').textContent = err.message;
  }
}

// --- Edit Bucket ---

function openEditBucket(id) {
  const b = state.buckets.find(x => x.id === id);
  if (!b) return;

  const colorButtons = COLORS.map(c =>
    `<div class="color-option ${c === b.color ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`
  ).join('');

  openModal('Edit Bucket', `
    <div class="form-group">
      <label for="bucket-name">Name</label>
      <input type="text" id="bucket-name" value="${escHtml(b.name)}" maxlength="40">
    </div>
    <div class="form-group">
      <label for="bucket-target">Target Amount</label>
      <input type="number" id="bucket-target" step="0.01" min="0" value="${b.targetAmount}">
    </div>
    <div class="form-group">
      <label>Color</label>
      <div class="color-options">${colorButtons}</div>
    </div>
    <div class="form-error" id="bucket-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitEditBucket('${id}')">Save</button>
    </div>
  `);
  document.getElementById('bucket-name').focus();
}

async function submitEditBucket(id) {
  const name = document.getElementById('bucket-name').value.trim();
  const target = parseFloat(document.getElementById('bucket-target').value);
  const color = document.querySelector('.color-option.selected')?.dataset.color || COLORS[0];

  if (!name) {
    document.getElementById('bucket-error').textContent = 'Name is required';
    return;
  }
  if (isNaN(target) || target < 0) {
    document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
    return;
  }

  try {
    state = await api('PUT', `/api/buckets/${id}`, {
      name, targetAmount: Math.round(target * 100) / 100, color,
    });
    closeModal();
    render();
    showToast('Bucket updated');
  } catch (err) {
    document.getElementById('bucket-error').textContent = err.message;
  }
}

// --- Add/Remove Money ---

function openAddRemove(id) {
  const b = state.buckets.find(x => x.id === id);
  if (!b) return;

  openModal(`Add/Remove - ${b.name}`, `
    <p class="modal-subtitle" style="margin-bottom:1rem">
      Currently allocated: <strong class="modal-value-primary">${fmt(b.allocatedAmount)}</strong><br>
      Unallocated funds: <strong class="modal-value-accent">${fmt(getUnallocated())}</strong>
    </p>
    <div class="form-group">
      <label for="addremove-amount">Amount</label>
      <input type="number" id="addremove-amount" step="0.01" min="0" placeholder="50.00">
    </div>
    <div class="form-error" id="addremove-error"></div>
    <div class="form-actions">
      <button class="btn-danger" onclick="submitAddRemove('${id}', 'remove')">Remove</button>
      <button class="btn-primary" onclick="submitAddRemove('${id}', 'add')">Add</button>
    </div>
  `);
  document.getElementById('addremove-amount').focus();
}

async function submitAddRemove(id, direction) {
  const amount = parseFloat(document.getElementById('addremove-amount').value);
  if (isNaN(amount) || amount <= 0) {
    document.getElementById('addremove-error').textContent = 'Enter a positive amount';
    return;
  }

  try {
    if (direction === 'add') {
      state = await api('POST', '/api/buckets/transfer', {
        fromId: 'unallocated', toId: id, amount: Math.round(amount * 100) / 100,
      });
    } else {
      state = await api('POST', '/api/buckets/transfer', {
        fromId: id, toId: 'unallocated', amount: Math.round(amount * 100) / 100,
      });
    }
    closeModal();
    render();
    showToast(direction === 'add' ? 'Funds added' : 'Funds removed');
  } catch (err) {
    document.getElementById('addremove-error').textContent = err.message;
  }
}

// --- Delete Bucket ---

function openDeleteBucket(id) {
  const b = state.buckets.find(x => x.id === id);
  if (!b) return;

  openModal('Delete Bucket', `
    <p style="margin-bottom:0.5rem">Are you sure you want to delete <strong>${escHtml(b.name)}</strong>?</p>
    <p class="modal-subtitle" style="margin-bottom:1rem">${fmt(b.allocatedAmount)} will return to your unallocated funds.</p>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="submitDelete('${id}')">Delete</button>
    </div>
  `);
}

async function submitDelete(id) {
  try {
    state = await api('DELETE', `/api/buckets/${id}`);
    closeModal();
    render();
    showToast('Bucket deleted');
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Transfer ---

function openTransfer() {
  if (state.buckets.length < 2) {
    showToast('Need at least 2 buckets to transfer', true);
    return;
  }

  const options = state.buckets.map(b =>
    `<option value="${b.id}">${escHtml(b.name)} (${fmt(b.allocatedAmount)})</option>`
  ).join('');

  const optionsWithUnalloc = `<option value="unallocated">Unallocated (${fmt(getUnallocated())})</option>` + options;

  openModal('Transfer Money', `
    <div class="form-group">
      <label for="transfer-from">From</label>
      <select id="transfer-from">${optionsWithUnalloc}</select>
    </div>
    <div class="form-group">
      <label for="transfer-to">To</label>
      <select id="transfer-to">${optionsWithUnalloc}</select>
    </div>
    <div class="form-group">
      <label for="transfer-amount">Amount</label>
      <input type="number" id="transfer-amount" step="0.01" min="0" placeholder="50.00">
    </div>
    <div class="form-error" id="transfer-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitTransfer()">Transfer</button>
    </div>
  `);

  // Default "to" to second option
  const toSelect = document.getElementById('transfer-to');
  if (toSelect.options.length > 1) toSelect.selectedIndex = 1;
}

async function submitTransfer() {
  const fromId = document.getElementById('transfer-from').value;
  const toId = document.getElementById('transfer-to').value;
  const amount = parseFloat(document.getElementById('transfer-amount').value);

  if (fromId === toId) {
    document.getElementById('transfer-error').textContent = 'Select different source and destination';
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    document.getElementById('transfer-error').textContent = 'Enter a positive amount';
    return;
  }

  try {
    state = await api('POST', '/api/buckets/transfer', {
      fromId, toId, amount: Math.round(amount * 100) / 100,
    });
    closeModal();
    render();
    showToast('Transfer complete');
  } catch (err) {
    document.getElementById('transfer-error').textContent = err.message;
  }
}

// --- Plaid ---

async function fetchPlaidStatus() {
  try {
    plaidStatus = await api('GET', '/api/plaid/status');
  } catch (err) {
    plaidStatus = { configured: false, linked: false, accounts: [] };
  }
  renderPlaidSection();
}

function renderPlaidSection() {
  const section = document.getElementById('plaid-section');
  if (!plaidStatus.configured) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  if (!plaidStatus.linked) {
    const sandboxBtn = plaidStatus.sandbox
      ? `<button class="btn-sync" onclick="sandboxSetup()" id="sandbox-setup-btn">&#x1F9EA; Sandbox Quick Setup</button>`
      : '';
    section.innerHTML = `
      <div class="plaid-status">
        <div class="plaid-info">
          <span class="account-detail">Connect your bank or credit card for automatic syncing</span>
          ${plaidStatus.sandbox ? '<span class="last-synced">Sandbox mode — use Quick Setup for test accounts</span>' : ''}
        </div>
        <div class="plaid-actions">
          <button class="btn-link-bank" onclick="startPlaidLink()">Link Account</button>
          ${sandboxBtn}
        </div>
      </div>
    `;
  } else {
    const accounts = plaidStatus.accounts || [];
    const accountList = accounts.map(a => {
      const icon = a.type === 'credit' ? '&#x1F4B3;' : '&#x1F3E6;';
      const typeLabel = a.type === 'credit' ? 'Credit Card' : (a.subtype === 'checking' ? 'Checking' : (a.subtype === 'savings' ? 'Savings' : 'Account'));
      const label = `${a.name}${a.mask ? ' ····' + a.mask : ''}`;
      return `
        <div class="plaid-account-row">
          <span class="plaid-account-icon">${icon}</span>
          <span class="plaid-account-name">${escHtml(label)}</span>
          <span class="plaid-account-type">${typeLabel}</span>
        </div>
      `;
    }).join('');

    const lastSynced = state.plaid?.lastSynced
      ? 'Last synced: ' + new Date(state.plaid.lastSynced).toLocaleString()
      : 'Not yet synced';

    section.innerHTML = `
      <div class="plaid-status">
        <div class="plaid-info">
          <div class="plaid-accounts-list">
            <span class="plaid-connected-dot"></span>
            <span class="plaid-connected-label">Connected Accounts</span>
          </div>
          ${accountList}
          <span class="last-synced">${lastSynced}</span>
        </div>
        <div class="plaid-actions">
          <button class="btn-sync" id="sync-txn-btn" onclick="syncTransactions()">Sync Transactions</button>
          <button class="btn-sync" id="sync-btn" onclick="syncBalance()">Sync Balance</button>
          <button class="btn-disconnect" onclick="disconnectBank()">Disconnect</button>
        </div>
      </div>
    `;
  }
}

async function startPlaidLink() {
  if (typeof Plaid === 'undefined') {
    showToast('Plaid Link script not loaded. Check your internet connection.', true);
    return;
  }

  try {
    const { link_token } = await api('POST', '/api/plaid/create_link_token');

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        try {
          const result = await api('POST', '/api/plaid/exchange_token', { public_token });
          plaidStatus.linked = true;
          plaidStatus.accounts = result.accounts;
          renderPlaidSection();
          showToast('Account linked successfully');
        } catch (err) {
          showToast(err.message, true);
        }
      },
      onExit: (err, metadata) => {
        if (err) {
          console.error('Plaid Link exit error:', err);
        }
      },
    });

    handler.open();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function sandboxSetup() {
  const btn = document.getElementById('sandbox-setup-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Setting up...';
  }

  try {
    const result = await api('POST', '/api/plaid/sandbox_setup');
    plaidStatus.linked = true;
    plaidStatus.accounts = result.accounts;
    await fetchState();
    renderPlaidSection();
    showToast('Sandbox accounts linked — 1 checking + 1 credit card');
  } catch (err) {
    showToast(err.message, true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🧪 Sandbox Quick Setup';
    }
  }
}

async function syncBalance() {
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
  }

  try {
    state = await api('POST', '/api/plaid/sync_balance');
    render();
    showToast('Balance synced from bank');
  } catch (err) {
    if (err.message.includes('re-link')) {
      plaidStatus.linked = false;
      renderPlaidSection();
    }
    showToast(err.message, true);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync Balance';
    }
  }
}

async function disconnectBank() {
  if (!confirm('Disconnect your bank account? You can re-link later.')) return;

  try {
    state = await api('DELETE', '/api/plaid/disconnect');
    plaidStatus.linked = false;
    plaidStatus.accounts = [];
    render();
    showToast('Bank account disconnected');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function syncTransactions() {
  const syncBtn = document.getElementById('sync-txn-btn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
  }

  try {
    const result = await api('POST', '/api/plaid/sync_transactions');
    const summary = result.syncSummary;
    delete result.syncSummary;
    state = result;
    render();

    if (summary.added === 0 && summary.modified === 0 && summary.removed === 0) {
      showToast('No new transactions to import');
    } else {
      openSyncSummaryModal(summary);
    }
  } catch (err) {
    if (err.message.includes('re-link')) {
      plaidStatus.linked = false;
      renderPlaidSection();
    }
    showToast(err.message, true);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync Transactions';
    }
  }
}

function openSyncSummaryModal(summary) {
  const lines = [];
  if (summary.added > 0) {
    lines.push(`<div class="sync-stat"><span class="sync-stat-num">${summary.added}</span> transactions imported</div>`);
    lines.push(`<div class="sync-stat indent"><span class="sync-stat-num accent">${summary.autoAssigned}</span> auto-assigned to buckets</div>`);
    if (summary.uncategorized > 0) {
      lines.push(`<div class="sync-stat indent"><span class="sync-stat-num warning">${summary.uncategorized}</span> uncategorized</div>`);
    }
  }
  if (summary.modified > 0) {
    lines.push(`<div class="sync-stat"><span class="sync-stat-num">${summary.modified}</span> transactions updated</div>`);
  }
  if (summary.removed > 0) {
    lines.push(`<div class="sync-stat"><span class="sync-stat-num">${summary.removed}</span> transactions removed</div>`);
  }

  openModal('Sync Complete', `
    <div class="sync-summary">${lines.join('')}</div>
    ${summary.uncategorized > 0 ? '<p class="sync-hint">Uncategorized transactions appear in your history. Tap "Assign" to categorize them.</p>' : ''}
    <div class="form-actions" style="margin-top:1.5rem">
      <button class="btn-primary" onclick="closeModal()">Done</button>
    </div>
  `);
}

// --- Log Purchase ---

function openLogPurchase(preselectedBucketId) {
  if (state.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const bucketOptions = state.buckets.map(b =>
    `<option value="${b.id}" ${b.id === preselectedBucketId ? 'selected' : ''}>${escHtml(b.name)} (${fmt(b.allocatedAmount)} available)</option>`
  ).join('');

  const today = new Date().toISOString().split('T')[0];

  openModal('Log Purchase', `
    <div class="form-group">
      <label for="txn-vendor">Vendor</label>
      <input type="text" id="txn-vendor" placeholder="e.g. Starbucks, Amazon" maxlength="80" oninput="checkAutoAssign()">
      <div class="hint" id="txn-auto-hint"></div>
    </div>
    <div class="form-group">
      <label for="txn-amount">Amount</label>
      <input type="number" id="txn-amount" step="0.01" min="0" placeholder="25.00">
    </div>
    <div class="form-group">
      <label for="txn-bucket">Bucket</label>
      <select id="txn-bucket">${bucketOptions}</select>
    </div>
    <div class="form-group">
      <label for="txn-date">Date</label>
      <input type="date" id="txn-date" value="${today}">
    </div>
    <div class="form-group">
      <label for="txn-note">Note (optional)</label>
      <input type="text" id="txn-note" placeholder="Optional note" maxlength="120">
    </div>
    <div class="form-error" id="txn-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitTransaction()">Log Purchase</button>
    </div>
  `);
  document.getElementById('txn-vendor').focus();
}

function checkAutoAssign() {
  const vendorInput = document.getElementById('txn-vendor').value.trim().toLowerCase();
  const hintEl = document.getElementById('txn-auto-hint');
  const bucketSelect = document.getElementById('txn-bucket');

  if (!vendorInput) {
    hintEl.textContent = '';
    return;
  }

  const rules = state.autoAssignRules || [];
  const matchedRule = rules.find(r => vendorInput.includes(r.pattern));

  if (matchedRule) {
    const bucket = state.buckets.find(b => b.id === matchedRule.bucketId);
    if (bucket) {
      bucketSelect.value = matchedRule.bucketId;
      hintEl.textContent = `Auto-assigned to ${bucket.name}`;
      hintEl.style.color = 'var(--color-success)';
    } else {
      hintEl.textContent = '';
    }
  } else {
    hintEl.textContent = '';
  }
}

async function submitTransaction() {
  const vendor = document.getElementById('txn-vendor').value.trim();
  const amount = parseFloat(document.getElementById('txn-amount').value);
  const bucketId = document.getElementById('txn-bucket').value;
  const date = document.getElementById('txn-date').value;
  const note = document.getElementById('txn-note').value.trim();

  if (!vendor) {
    document.getElementById('txn-error').textContent = 'Vendor name is required';
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    document.getElementById('txn-error').textContent = 'Enter a valid amount';
    return;
  }

  try {
    state = await api('POST', '/api/transactions', {
      vendor,
      amount: Math.round(amount * 100) / 100,
      bucketId,
      note,
      date: date || undefined,
    });
    closeModal();
    render();
    showToast(`${fmt(amount)} spent at ${vendor}`);
  } catch (err) {
    document.getElementById('txn-error').textContent = err.message;
  }
}

// --- Transaction History ---

function renderTransactionHistory() {
  const listEl = document.getElementById('transaction-list');
  const emptyEl = document.getElementById('transactions-empty');
  const txns = (state.transactions || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (txns.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const displayed = txns.slice(0, 20);
  listEl.innerHTML = displayed.map(t => {
    const bucket = state.buckets.find(b => b.id === t.bucketId);
    const plaidBadge = t.source === 'plaid' ? '<span class="txn-plaid-badge" title="Imported from Plaid">&#x1F517;</span>' : '';
    let bucketLabel;
    if (t.bucketId && bucket) {
      bucketLabel = `<span class="txn-bucket"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bucket.color};margin-right:4px;vertical-align:middle"></span>${escHtml(bucket.name)}</span>`;
    } else if (t.bucketId && !bucket) {
      bucketLabel = '<span class="txn-bucket deleted">Deleted bucket</span>';
    } else {
      bucketLabel = `<span class="txn-bucket uncategorized">Uncategorized <button class="btn-assign" onclick="openAssignBucket('${t.id}')">Assign</button></span>`;
    }
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="txn-row ${!t.bucketId ? 'txn-uncategorized' : ''}">
        <div class="txn-info">
          <span class="txn-vendor">${plaidBadge}${escHtml(t.vendor)}</span>
          ${t.note ? `<span class="txn-note">${escHtml(t.note)}</span>` : ''}
        </div>
        <div class="txn-meta">
          ${bucketLabel}
          <span class="txn-date">${dateStr}</span>
        </div>
        <div class="txn-amount">-${fmt(t.amount)}</div>
        <button class="btn-icon txn-delete" onclick="deleteTransaction('${t.id}')" title="Delete">&times;</button>
      </div>
    `;
  }).join('');

  if (txns.length > 20) {
    listEl.innerHTML += `<button class="btn-small txn-show-more" onclick="showAllTransactions()">Show all (${txns.length})</button>`;
  }
}

function showAllTransactions() {
  const txns = (state.transactions || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = txns.map(t => {
    const bucket = state.buckets.find(b => b.id === t.bucketId);
    const plaidBadge = t.source === 'plaid' ? '<span class="txn-plaid-badge">&#x1F517;</span>' : '';
    let bucketName;
    if (t.bucketId && bucket) {
      bucketName = escHtml(bucket.name);
    } else if (t.bucketId && !bucket) {
      bucketName = 'Deleted bucket';
    } else {
      bucketName = `<span class="txn-bucket uncategorized">Uncategorized <button class="btn-assign" onclick="closeModal();openAssignBucket('${t.id}')">Assign</button></span>`;
    }
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="rule-row">
        <span class="txn-vendor" style="flex:1">${plaidBadge}${escHtml(t.vendor)}</span>
        <span class="txn-amount">-${fmt(t.amount)}</span>
        <span style="color:var(--text-secondary);font-size:0.8rem">${bucketName}</span>
        <span class="txn-date">${dateStr}</span>
        <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="Delete">&times;</button>
      </div>
    `;
  }).join('');

  openModal(`All Transactions (${txns.length})`, `
    <div style="max-height:400px;overflow-y:auto">${rows || '<p class="empty-hint">No transactions</p>'}</div>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

function openBucketTransactions(bucketId) {
  const bucket = state.buckets.find(b => b.id === bucketId);
  if (!bucket) return;

  const txns = (state.transactions || [])
    .filter(t => t.bucketId === bucketId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = txns.map(t => {
    const plaidBadge = t.source === 'plaid' ? '<span class="txn-plaid-badge">&#x1F517;</span>' : '';
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="rule-row">
        <span class="txn-vendor" style="flex:1">${plaidBadge}${escHtml(t.vendor)}</span>
        <span class="txn-amount">-${fmt(t.amount)}</span>
        <span class="txn-date">${dateStr}</span>
        <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="Delete">&times;</button>
      </div>
    `;
  }).join('');

  openModal(`${escHtml(bucket.name)} — Transactions`, `
    <div style="max-height:400px;overflow-y:auto">${rows || '<p class="empty-hint">No transactions for this bucket</p>'}</div>
    <div class="form-actions" style="margin-top:1rem">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

function deleteTransaction(id) {
  const txn = (state.transactions || []).find(t => t.id === id);
  if (!txn) return;

  const plaidNote = txn.source === 'plaid'
    ? '<p style="margin-bottom:0.5rem;color:var(--text-tertiary);font-size:0.8rem">Imported from Plaid. Deleting removes it from your budget but it won\'t re-import.</p>'
    : '';

  openModal('Delete Transaction', `
    <p style="margin-bottom:0.5rem">Delete <strong>${fmt(txn.amount)}</strong> at <strong>${escHtml(txn.vendor)}</strong>?</p>
    <p class="modal-subtitle" style="margin-bottom:0.5rem">${fmt(txn.amount)} will be refunded to ${txn.bucketId ? 'the bucket and ' : ''}balance.</p>
    ${plaidNote}
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="confirmDeleteTransaction('${id}')">Delete</button>
    </div>
  `);
}

async function confirmDeleteTransaction(id) {
  try {
    state = await api('DELETE', `/api/transactions/${id}`);
    closeModal();
    render();
    showToast('Transaction deleted and refunded');
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Assign Uncategorized Transaction ---

function openAssignBucket(txnId) {
  const txn = (state.transactions || []).find(t => t.id === txnId);
  if (!txn) return;

  if (state.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const bucketOptions = state.buckets.map(b =>
    `<option value="${b.id}">${escHtml(b.name)} (${fmt(b.allocatedAmount)} available)</option>`
  ).join('');

  openModal('Assign to Bucket', `
    <p style="margin-bottom:1rem">
      <strong>${escHtml(txn.vendor)}</strong> &mdash; <span class="txn-amount">-${fmt(txn.amount)}</span>
    </p>
    <div class="form-group">
      <label for="assign-bucket">Bucket</label>
      <select id="assign-bucket">${bucketOptions}</select>
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label style="display:flex;align-items:center;gap:0.5rem;text-transform:none;letter-spacing:normal;font-size:0.8rem;color:var(--text-secondary)">
        <input type="checkbox" id="assign-create-rule"> Also create auto-assign rule for "${escHtml(txn.vendor)}"
      </label>
    </div>
    <div class="form-error" id="assign-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitAssignBucket('${txnId}')">Assign</button>
    </div>
  `);
}

async function submitAssignBucket(txnId) {
  const bucketId = document.getElementById('assign-bucket').value;
  const createRule = document.getElementById('assign-create-rule').checked;
  const txn = (state.transactions || []).find(t => t.id === txnId);

  try {
    state = await api('PUT', `/api/transactions/${txnId}/assign`, { bucketId });

    if (createRule && txn) {
      try {
        state = await api('POST', '/api/auto-assign-rules', {
          pattern: txn.vendor.toLowerCase(),
          bucketId,
        });
      } catch (ruleErr) {
        // Rule may already exist; not critical
        console.warn('Could not create rule:', ruleErr.message);
      }
    }

    closeModal();
    render();
    const bucket = state.buckets.find(b => b.id === bucketId);
    showToast(`Assigned to ${bucket ? bucket.name : 'bucket'}`);
  } catch (err) {
    const errEl = document.getElementById('assign-error');
    if (errEl) errEl.textContent = err.message;
  }
}

// --- Auto-Assign Rules ---

function openManageRules() {
  const rules = state.autoAssignRules || [];

  const bucketOptions = state.buckets.map(b =>
    `<option value="${b.id}">${escHtml(b.name)}</option>`
  ).join('');

  const ruleRows = rules.length > 0
    ? rules.map(r => {
        const bucket = state.buckets.find(b => b.id === r.bucketId);
        const bucketName = bucket ? escHtml(bucket.name) : 'Deleted bucket';
        return `
          <div class="rule-row">
            <span class="rule-pattern">"${escHtml(r.pattern)}"</span>
            <span class="rule-arrow">&rarr;</span>
            <span class="rule-bucket">${bucketName}</span>
            <button class="btn-icon" onclick="deleteRule('${r.id}')" title="Delete">&times;</button>
          </div>
        `;
      }).join('')
    : '<p class="empty-hint" style="padding:1rem 0">No rules yet. Add one below.</p>';

  openModal('Auto-Assign Rules', `
    <div id="rules-list">${ruleRows}</div>
    <hr class="rule-divider">
    <div class="form-group">
      <label for="rule-pattern">Vendor Pattern</label>
      <input type="text" id="rule-pattern" placeholder="e.g. starbucks" maxlength="80">
      <div class="hint">Case-insensitive. Matches if vendor name contains this text.</div>
    </div>
    <div class="form-group">
      <label for="rule-bucket">Assign to Bucket</label>
      <select id="rule-bucket">${bucketOptions}</select>
    </div>
    <div class="form-error" id="rule-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-primary" onclick="submitRule()">Add Rule</button>
    </div>
  `);
}

async function submitRule() {
  const pattern = document.getElementById('rule-pattern').value.trim();
  const bucketId = document.getElementById('rule-bucket').value;

  if (!pattern) {
    document.getElementById('rule-error').textContent = 'Pattern is required';
    return;
  }

  try {
    state = await api('POST', '/api/auto-assign-rules', { pattern, bucketId });
    render();
    showToast('Rule added');
    openManageRules(); // Re-open to show updated list
  } catch (err) {
    document.getElementById('rule-error').textContent = err.message;
  }
}

async function deleteRule(id) {
  try {
    state = await api('DELETE', `/api/auto-assign-rules/${id}`);
    render();
    showToast('Rule deleted');
    openManageRules(); // Re-open to show updated list
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Event Listeners ---

document.getElementById('edit-balance-btn').addEventListener('click', openEditBalance);
document.getElementById('new-bucket-btn').addEventListener('click', openNewBucket);
document.getElementById('transfer-btn').addEventListener('click', openTransfer);
document.getElementById('log-purchase-btn').addEventListener('click', () => openLogPurchase(null));
document.getElementById('manage-rules-btn').addEventListener('click', openManageRules);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  // Submit on Enter inside modals
  if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
    const primaryBtn = document.querySelector('#modal-body .btn-primary');
    if (primaryBtn) primaryBtn.click();
  }
});

// --- Init ---
fetchState();
fetchPlaidStatus();
