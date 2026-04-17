// --- State ---
let state = { pools: [], activePoolId: null };
let plaidStatus = { configured: false, linked: false, items: [], accounts: [], sandbox: false };

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

// --- SVG Icons ---
const icons = {
  droplet: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  receipt: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
  pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  arrowsUpDown: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  flask: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6"/><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/></svg>',
  creditCard: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  building: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 8 4 8"/></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  bucket: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/><path d="M5 6l1.5 14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2L19 6"/><path d="M5 6h14"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>',
  share: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>',
  sync: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
  plug: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/></svg>',
  rules: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  ellipsis: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  piggyBank: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h0"/></svg>',
};

// --- Swipe Controller ---

const SwipeController = {
  THRESHOLD: 80,
  VELOCITY_THRESHOLD: 0.3,
  MAX_LEFT_OFFSET: -210,
  MAX_RIGHT_OFFSET: 80,
  ANGLE_THRESHOLD: 30,

  activeCard: null,
  currentCard: null,
  startX: 0,
  startY: 0,
  currentDx: 0,
  startTime: 0,
  isDragging: false,
  isScrolling: null,

  init() {
    const grid = document.getElementById('bucket-grid');
    if (!grid) return;

    grid.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    grid.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    grid.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

    grid.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    document.addEventListener('click', (e) => {
      if (this.activeCard && !this.activeCard.contains(e.target)) {
        this.closeAll();
      }
    });

    grid.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.swipe-action-btn');
      if (actionBtn) {
        e.stopPropagation();
        this.handleActionClick(actionBtn);
        return;
      }
      const triggerBtn = e.target.closest('.swipe-actions-trigger');
      if (triggerBtn) {
        e.stopPropagation();
        this.handleTriggerClick(triggerBtn);
        return;
      }
    });
  },

  getSwipeContent(card) {
    return card.querySelector('.swipe-content');
  },

  getExistingOffset(card) {
    const s = card.dataset.swipeState;
    if (s === 'left') return this.MAX_LEFT_OFFSET;
    if (s === 'right') return this.MAX_RIGHT_OFFSET;
    return 0;
  },

  handleTouchStart(e) {
    const card = e.target.closest('.swipe-container');
    if (!card) return;
    const touch = e.touches[0];
    this.currentCard = card;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentDx = 0;
    this.startTime = Date.now();
    this.isDragging = false;
    this.isScrolling = null;
  },

  handleTouchMove(e) {
    if (!this.currentCard) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;

    if (this.isScrolling === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
      this.isScrolling = angle > this.ANGLE_THRESHOLD;
      if (this.isScrolling) { this.currentCard = null; return; }
    }
    if (this.isScrolling) return;

    e.preventDefault();

    if (!this.isDragging) {
      this.isDragging = true;
      this.getSwipeContent(this.currentCard).classList.add('dragging');
      if (this.activeCard && this.activeCard !== this.currentCard) {
        this.closeCard(this.activeCard);
      }
    }

    let offset = dx + this.getExistingOffset(this.currentCard);
    if (offset < this.MAX_LEFT_OFFSET) {
      offset = this.MAX_LEFT_OFFSET + (offset - this.MAX_LEFT_OFFSET) * 0.2;
    }
    if (offset > this.MAX_RIGHT_OFFSET) {
      offset = this.MAX_RIGHT_OFFSET + (offset - this.MAX_RIGHT_OFFSET) * 0.2;
    }

    this.currentDx = dx;
    this.getSwipeContent(this.currentCard).style.transform = `translateX(${offset}px)`;
  },

  handleTouchEnd() {
    if (!this.currentCard || !this.isDragging) { this.currentCard = null; return; }
    const content = this.getSwipeContent(this.currentCard);
    content.classList.remove('dragging');

    const elapsed = Date.now() - this.startTime;
    const velocity = Math.abs(this.currentDx) / elapsed;
    const dx = this.currentDx;

    if (dx < 0 && (Math.abs(dx) > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(this.currentCard, 'left');
    } else if (dx > 0 && (dx > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(this.currentCard, 'right');
    } else {
      this.closeCard(this.currentCard);
    }

    // Prevent accidental click after swipe
    const card = this.currentCard;
    const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    card.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => card.removeEventListener('click', swallowClick, true), 300);

    this.currentCard = null;
    this.isDragging = false;
  },

  handleMouseDown(e) {
    const card = e.target.closest('.swipe-container');
    if (!card || e.target.closest('button, a, input')) return;
    this.currentCard = card;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentDx = 0;
    this.startTime = Date.now();
    this.isDragging = false;
    this.isScrolling = null;
    e.preventDefault();
  },

  handleMouseMove(e) {
    if (!this.currentCard) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (this.isScrolling === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
      this.isScrolling = angle > this.ANGLE_THRESHOLD;
      if (this.isScrolling) { this.currentCard = null; return; }
    }
    if (this.isScrolling) return;

    if (!this.isDragging) {
      this.isDragging = true;
      this.getSwipeContent(this.currentCard).classList.add('dragging');
      if (this.activeCard && this.activeCard !== this.currentCard) {
        this.closeCard(this.activeCard);
      }
    }

    let offset = dx + this.getExistingOffset(this.currentCard);
    if (offset < this.MAX_LEFT_OFFSET) {
      offset = this.MAX_LEFT_OFFSET + (offset - this.MAX_LEFT_OFFSET) * 0.2;
    }
    if (offset > this.MAX_RIGHT_OFFSET) {
      offset = this.MAX_RIGHT_OFFSET + (offset - this.MAX_RIGHT_OFFSET) * 0.2;
    }

    this.currentDx = dx;
    this.getSwipeContent(this.currentCard).style.transform = `translateX(${offset}px)`;
  },

  handleMouseUp() {
    if (!this.currentCard || !this.isDragging) { this.currentCard = null; return; }
    const content = this.getSwipeContent(this.currentCard);
    content.classList.remove('dragging');

    const elapsed = Date.now() - this.startTime;
    const velocity = Math.abs(this.currentDx) / elapsed;
    const dx = this.currentDx;

    if (dx < 0 && (Math.abs(dx) > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(this.currentCard, 'left');
    } else if (dx > 0 && (dx > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(this.currentCard, 'right');
    } else {
      this.closeCard(this.currentCard);
    }

    this.currentCard = null;
    this.isDragging = false;
  },

  openCard(card, direction) {
    const content = this.getSwipeContent(card);
    const isSavings = activePool().type === 'savings';
    // Savings cards have fewer right actions (edit only), adjust offset
    const leftOffset = isSavings ? -140 : this.MAX_LEFT_OFFSET;
    const offset = direction === 'left' ? leftOffset : this.MAX_RIGHT_OFFSET;
    content.style.transform = `translateX(${offset}px)`;
    card.dataset.swipeState = direction;
    this.activeCard = card;
  },

  closeCard(card) {
    if (!card) return;
    const content = this.getSwipeContent(card);
    if (content) content.style.transform = 'translateX(0)';
    delete card.dataset.swipeState;
    if (this.activeCard === card) this.activeCard = null;
  },

  closeAll() {
    document.querySelectorAll('.swipe-container[data-swipe-state]').forEach(card => {
      this.closeCard(card);
    });
    this.activeCard = null;
  },

  handleActionClick(btn) {
    const action = btn.dataset.action;
    const bucketId = btn.dataset.bucketId;
    this.closeAll();
    switch (action) {
      case 'spend': openLogPurchase(bucketId); break;
      case 'edit': openEditBucket(bucketId); break;
      case 'funds': openAddRemove(bucketId); break;
      case 'delete': openDeleteBucket(bucketId); break;
    }
  },

  handleTriggerClick(btn) {
    const card = btn.closest('.swipe-container');
    if (card.dataset.swipeState) {
      this.closeCard(card);
    } else {
      if (this.activeCard) this.closeCard(this.activeCard);
      this.openCard(card, 'left');
    }
  },
};

// --- API Helpers ---

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function poolApi(method, path, body) {
  const pool = activePool();
  return api(method, `/api/pools/${pool.id}${path}`, body);
}

// --- Pool Helpers ---

function activePool() {
  return state.pools.find(p => p.id === state.activePoolId) || state.pools[0] || {
    id: '', name: '', type: 'spending', balance: 0,
    buckets: [], transactions: [], autoAssignRules: [], linkedAccountIds: [],
  };
}

function isSpending() {
  return activePool().type === 'spending';
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
  return activePool().buckets.reduce((s, b) => s + (b.allocatedAmount || 0), 0);
}

function getUnallocated() {
  return activePool().balance - getTotalAllocated();
}

function getTotalPercentage() {
  return activePool().buckets.reduce((s, b) => s + (b.percentage || 0), 0);
}

// --- Rendering ---

function render() {
  renderPoolTabs();
  renderBalance();
  renderSummaryBar();
  renderBuckets();
  renderPlaidSection();
  renderTransactionHistory();
  renderSectionActions();
  SwipeController.closeAll();
}

// --- Pool Tabs ---

function renderPoolTabs() {
  const nav = document.getElementById('pool-tabs');
  if (!nav) return;

  nav.innerHTML = state.pools.map(p =>
    `<button class="pool-tab ${p.id === state.activePoolId ? 'active' : ''}" onclick="switchPool('${p.id}')">
      <span class="pool-tab-name">${escHtml(p.name)}</span>
      ${p.type === 'savings' ? '<span class="pool-tab-badge">%</span>' : ''}
    </button>`
  ).join('') +
    `<button class="pool-tab pool-tab-add" onclick="openNewPool()" title="New Pool">${icons.plus}</button>`;
}

async function switchPool(poolId) {
  try {
    state = await api('PUT', `/api/pools/${poolId}/active`);
    render();
  } catch (err) {
    showToast(err.message, true);
  }
}

function openNewPool() {
  openModal('New Pool', `
    <div class="form-group">
      <label for="pool-name">Pool Name</label>
      <input type="text" id="pool-name" placeholder="e.g. Savings, Checking" maxlength="30">
    </div>
    <div class="form-group">
      <label>Pool Type</label>
      <div class="pool-type-options">
        <label class="pool-type-option selected" onclick="selectPoolType(this, 'spending')">
          <input type="radio" name="pool-type" value="spending" checked style="display:none">
          <span class="pool-type-icon">${icons.receipt}</span>
          <span class="pool-type-label">Spending</span>
          <span class="pool-type-desc">Dollar-based buckets with goals</span>
        </label>
        <label class="pool-type-option" onclick="selectPoolType(this, 'savings')">
          <input type="radio" name="pool-type" value="savings" style="display:none">
          <span class="pool-type-icon">${icons.piggyBank}</span>
          <span class="pool-type-label">Savings</span>
          <span class="pool-type-desc">Percentage-based split</span>
        </label>
      </div>
    </div>
    <div class="form-error" id="pool-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitNewPool()">Create Pool</button>
    </div>
  `);
  document.getElementById('pool-name').focus();
}

function selectPoolType(el, type) {
  document.querySelectorAll('.pool-type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
}

async function submitNewPool() {
  const name = document.getElementById('pool-name').value.trim();
  const type = document.querySelector('input[name="pool-type"]:checked')?.value || 'spending';

  if (!name) {
    document.getElementById('pool-error').textContent = 'Name is required';
    return;
  }

  try {
    state = await api('POST', '/api/pools', { name, type, linkedAccountIds: [] });
    closeModal();
    render();
    showToast(`"${name}" pool created`);
  } catch (err) {
    document.getElementById('pool-error').textContent = err.message;
  }
}

function openEditPool() {
  const pool = activePool();
  if (!pool.id) return;

  openModal('Edit Pool', `
    <div class="form-group">
      <label for="pool-name">Pool Name</label>
      <input type="text" id="pool-name" value="${escHtml(pool.name)}" maxlength="30">
    </div>
    <div class="form-group">
      <label>Type</label>
      <p style="color:var(--text-secondary);font-size:0.9rem">${pool.type === 'savings' ? 'Savings (percentage-based)' : 'Spending (dollar-based)'}</p>
    </div>
    <div class="form-error" id="pool-error"></div>
    <div class="form-actions">
      ${state.pools.length > 1 ? `<button class="btn-danger" onclick="deletePool('${pool.id}')">Delete Pool</button>` : ''}
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitEditPool('${pool.id}')">Save</button>
    </div>
  `);
  document.getElementById('pool-name').focus();
}

async function submitEditPool(poolId) {
  const name = document.getElementById('pool-name').value.trim();
  if (!name) {
    document.getElementById('pool-error').textContent = 'Name is required';
    return;
  }

  try {
    state = await api('PUT', `/api/pools/${poolId}`, { name });
    closeModal();
    render();
    showToast('Pool updated');
  } catch (err) {
    document.getElementById('pool-error').textContent = err.message;
  }
}

async function deletePool(poolId) {
  if (!confirm('Delete this pool and all its buckets and transactions?')) return;
  try {
    state = await api('DELETE', `/api/pools/${poolId}`);
    closeModal();
    render();
    showToast('Pool deleted');
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Section Actions (conditional on pool type) ---

function renderSectionActions() {
  const pool = activePool();
  const logPurchaseBtn = document.getElementById('log-purchase-btn');
  const transferBtn = document.getElementById('transfer-btn');
  const logDepositBtn = document.getElementById('log-deposit-btn');

  if (pool.type === 'savings') {
    logPurchaseBtn.textContent = 'Log Withdrawal';
    transferBtn.classList.add('hidden');
    if (logDepositBtn) logDepositBtn.classList.remove('hidden');
  } else {
    logPurchaseBtn.textContent = 'Log Purchase';
    transferBtn.classList.remove('hidden');
    if (logDepositBtn) logDepositBtn.classList.add('hidden');
  }
}

// --- Deposit (savings pools) ---

function openLogDeposit() {
  const pool = activePool();
  if (pool.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  openModal('Log Deposit', `
    <div class="form-group">
      <label for="deposit-check-total">Paycheck Total</label>
      <input type="number" id="deposit-check-total" step="0.01" min="0" placeholder="5000.00"
             oninput="updateDepositPreview()">
      <div class="hint">Full paycheck amount &mdash; bucket percentages apply to this</div>
    </div>
    <div class="form-group">
      <label for="deposit-amount">Amount to Savings</label>
      <input type="number" id="deposit-amount" step="0.01" min="0" placeholder="2500.00"
             oninput="updateDepositPreview()">
      <div class="hint">How much you're putting into this savings pool</div>
    </div>
    <div id="deposit-preview"></div>
    <div class="form-group">
      <label for="deposit-date">Date</label>
      <input type="date" id="deposit-date" value="${today}">
    </div>
    <div class="form-group">
      <label for="deposit-note">Note (optional)</label>
      <input type="text" id="deposit-note" placeholder="e.g. March paycheck" maxlength="120">
    </div>
    <div class="form-error" id="deposit-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitDeposit()">Log Deposit</button>
    </div>
  `);
  document.getElementById('deposit-check-total').focus();
}

function updateDepositPreview() {
  const pool = activePool();
  const checkTotal = parseFloat(document.getElementById('deposit-check-total').value) || 0;
  const depositAmount = parseFloat(document.getElementById('deposit-amount').value) || 0;
  const previewEl = document.getElementById('deposit-preview');

  if (checkTotal <= 0 || depositAmount <= 0) {
    previewEl.innerHTML = '';
    return;
  }

  let remaining = Math.min(depositAmount, checkTotal);
  let rows = '';

  for (const bucket of pool.buckets) {
    const need = Math.round(checkTotal * (bucket.percentage || 0)) / 100;
    const allocated = Math.round(Math.min(need, remaining) * 100) / 100;
    remaining = Math.round((remaining - allocated) * 100) / 100;
    rows += `
      <div class="deposit-preview-row">
        <span class="deposit-preview-label">
          <span class="bucket-color-dot" style="background:${bucket.color}"></span>
          ${escHtml(bucket.name)} (${bucket.percentage}%)
        </span>
        <strong>${fmt(allocated)}</strong>
      </div>
    `;
  }

  if (remaining > 0.004) {
    rows += `
      <div class="deposit-preview-row" style="color:var(--text-tertiary)">
        <span>Unallocated</span>
        <strong>${fmt(remaining)}</strong>
      </div>
    `;
  }

  if (depositAmount > checkTotal) {
    rows += `<div class="form-error">Deposit cannot exceed paycheck total</div>`;
  }

  previewEl.innerHTML = `
    <div class="deposit-preview-box">
      <div class="deposit-preview-title">Allocation Preview</div>
      ${rows}
    </div>
  `;
}

async function submitDeposit() {
  const checkTotal = parseFloat(document.getElementById('deposit-check-total').value);
  const depositAmount = parseFloat(document.getElementById('deposit-amount').value);
  const date = document.getElementById('deposit-date').value;
  const note = document.getElementById('deposit-note').value.trim();

  if (isNaN(checkTotal) || checkTotal <= 0) {
    document.getElementById('deposit-error').textContent = 'Enter a valid paycheck total';
    return;
  }
  if (isNaN(depositAmount) || depositAmount <= 0) {
    document.getElementById('deposit-error').textContent = 'Enter a valid deposit amount';
    return;
  }
  if (depositAmount > checkTotal) {
    document.getElementById('deposit-error').textContent = 'Deposit cannot exceed paycheck total';
    return;
  }

  try {
    state = await poolApi('POST', '/deposit', {
      checkTotal: Math.round(checkTotal * 100) / 100,
      depositAmount: Math.round(depositAmount * 100) / 100,
      date: date || undefined,
      note,
    });
    closeModal();
    render();
    showToast(`${fmt(depositAmount)} deposited`);
  } catch (err) {
    document.getElementById('deposit-error').textContent = err.message;
  }
}

// --- Balance ---

function renderBalance() {
  const pool = activePool();
  const totalEl = document.getElementById('total-balance');
  const allocEl = document.getElementById('total-allocated');
  const unallocEl = document.getElementById('unallocated');
  const allocLabel = document.querySelector('#balance-display .balance-item:nth-child(2) .balance-label');
  const unallocLabel = document.querySelector('#balance-display .balance-item:nth-child(3) .balance-label');

  totalEl.textContent = fmt(pool.balance);

  if (pool.type === 'savings') {
    const totalAccumulated = pool.buckets.reduce((s, b) => s + (b.accumulatedAmount || 0), 0);
    const unallocated = Math.round((pool.balance - totalAccumulated) * 100) / 100;
    allocEl.textContent = fmt(totalAccumulated);
    unallocEl.textContent = fmt(unallocated);
    unallocEl.className = 'balance-amount ' + (unallocated < 0 ? 'warning' : 'accent');
    if (allocLabel) allocLabel.textContent = 'Allocated';
    if (unallocLabel) unallocLabel.textContent = 'Unallocated';
  } else {
    allocEl.textContent = fmt(getTotalAllocated());
    const unalloc = getUnallocated();
    unallocEl.textContent = fmt(unalloc);
    unallocEl.className = 'balance-amount ' + (unalloc < 0 ? 'warning' : 'accent');
    if (allocLabel) allocLabel.textContent = 'Allocated';
    if (unallocLabel) unallocLabel.textContent = 'Unallocated';
  }
}

function renderSummaryBar() {
  const bar = document.getElementById('summary-bar');
  const pool = activePool();
  bar.innerHTML = '';

  if (pool.type === 'savings') {
    if (pool.balance > 0) {
      pool.buckets.forEach(b => {
        const amt = b.accumulatedAmount || 0;
        const pct = (amt / pool.balance) * 100;
        if (pct <= 0) return;
        const seg = document.createElement('div');
        seg.className = 'segment';
        seg.style.width = Math.min(pct, 100) + '%';
        seg.style.background = `linear-gradient(to bottom, ${b.color}ee, ${b.color})`;
        seg.title = `${b.name}: ${fmt(amt)} (${b.percentage}% rate)`;
        bar.appendChild(seg);
      });
    }
  } else {
    if (pool.balance <= 0) return;
    pool.buckets.forEach(b => {
      const pct = (b.allocatedAmount / pool.balance) * 100;
      if (pct <= 0) return;
      const seg = document.createElement('div');
      seg.className = 'segment';
      seg.style.width = Math.min(pct, 100) + '%';
      seg.style.background = `linear-gradient(to bottom, ${b.color}ee, ${b.color})`;
      seg.title = `${b.name}: ${fmt(b.allocatedAmount)}`;
      bar.appendChild(seg);
    });
  }
}

// --- Buckets ---

function renderBuckets() {
  const grid = document.getElementById('bucket-grid');
  const empty = document.getElementById('empty-state');
  const pool = activePool();

  if (pool.buckets.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  if (pool.type === 'savings') {
    grid.innerHTML = pool.buckets.map(b => renderSavingsBucketCard(b, pool.balance)).join('');
  } else {
    grid.innerHTML = pool.buckets.map(b => renderBucketCard(b)).join('');
  }
}

function renderBucketCard(b) {
  const pool = activePool();
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

  const waveSvg = fillPct > 0 ? `
    <svg class="bucket-fill-wave" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V16 H0Z" fill="${fillColor}" opacity="0.5"/>
      <path d="M0 10 Q30 4 60 10 T120 10 T180 10 T200 10 V16 H0Z" fill="${fillColor}" opacity="0.3"/>
    </svg>
    <svg class="bucket-fill-wave bucket-fill-wave-reverse" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M200 8 Q175 2 150 8 T100 8 T50 8 T0 8 V16 H200Z" fill="${fillColor}" opacity="0.2"/>
    </svg>
  ` : '';

  const txnCount = (pool.transactions || []).filter(t => t.bucketId === b.id).length;

  return `
    <div class="bucket-card swipe-container" data-id="${b.id}">
      <div class="swipe-actions swipe-actions-left">
        <button class="swipe-action-btn swipe-action-delete" data-action="delete" data-bucket-id="${b.id}">
          ${icons.trash}
          <span>Delete</span>
        </button>
      </div>
      <div class="swipe-actions swipe-actions-right">
        <button class="swipe-action-btn swipe-action-spend" data-action="spend" data-bucket-id="${b.id}">
          ${icons.receipt}
          <span>Spend</span>
        </button>
        <button class="swipe-action-btn swipe-action-edit" data-action="edit" data-bucket-id="${b.id}">
          ${icons.pencil}
          <span>Edit</span>
        </button>
        <button class="swipe-action-btn swipe-action-funds" data-action="funds" data-bucket-id="${b.id}">
          ${icons.arrowsUpDown}
          <span>Funds</span>
        </button>
      </div>
      <div class="swipe-content">
        <div class="bucket-card-header">
          <div class="bucket-name-row">
            <div class="bucket-color-dot" style="background:${b.color}"></div>
            <span class="bucket-name">${escHtml(b.name)}</span>
          </div>
        </div>
        <div class="bucket-amounts">
          <strong>${fmt(b.allocatedAmount)}</strong> / ${fmt(b.targetAmount)}
        </div>
        <div class="bucket-txn-count" onclick="openBucketTransactions('${b.id}')">${txnCount === 0 ? 'No transactions' : txnCount + ' transaction' + (txnCount !== 1 ? 's' : '')}</div>
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
        <button class="swipe-actions-trigger" aria-label="Card actions">${icons.ellipsis}</button>
      </div>
    </div>
  `;
}

function renderSavingsBucketCard(b, poolBalance) {
  const pool = activePool();
  const pct = b.percentage || 0;
  const accumulated = b.accumulatedAmount || 0;
  const fillPct = poolBalance > 0 ? Math.min((accumulated / poolBalance) * 100, 100) : 0;
  const fillColor = b.color;
  const textColor = fillPct > 40 ? 'white' : 'rgba(200,210,230,0.7)';

  const waveSvg = fillPct > 0 ? `
    <svg class="bucket-fill-wave" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V16 H0Z" fill="${fillColor}" opacity="0.5"/>
      <path d="M0 10 Q30 4 60 10 T120 10 T180 10 T200 10 V16 H0Z" fill="${fillColor}" opacity="0.3"/>
    </svg>
    <svg class="bucket-fill-wave bucket-fill-wave-reverse" viewBox="0 0 200 16" preserveAspectRatio="none">
      <path d="M200 8 Q175 2 150 8 T100 8 T50 8 T0 8 V16 H200Z" fill="${fillColor}" opacity="0.2"/>
    </svg>
  ` : '';

  const txnCount = (pool.transactions || []).filter(t =>
    t.bucketId === b.id || (t.type === 'deposit' && (t.allocations || []).some(a => a.bucketId === b.id))
  ).length;

  return `
    <div class="bucket-card swipe-container" data-id="${b.id}">
      <div class="swipe-actions swipe-actions-left">
        <button class="swipe-action-btn swipe-action-delete" data-action="delete" data-bucket-id="${b.id}">
          ${icons.trash}
          <span>Delete</span>
        </button>
      </div>
      <div class="swipe-actions swipe-actions-right">
        <button class="swipe-action-btn swipe-action-edit" data-action="edit" data-bucket-id="${b.id}">
          ${icons.pencil}
          <span>Edit</span>
        </button>
      </div>
      <div class="swipe-content">
        <div class="bucket-card-header">
          <div class="bucket-name-row">
            <div class="bucket-color-dot" style="background:${b.color}"></div>
            <span class="bucket-name">${escHtml(b.name)}</span>
          </div>
          <span class="bucket-pct-badge" style="background:${b.color}22;color:${b.color}">${pct}%</span>
        </div>
        <div class="bucket-amounts">
          <strong>${fmt(accumulated)}</strong>
        </div>
        <div class="bucket-txn-count" onclick="openBucketTransactions('${b.id}')">${txnCount === 0 ? 'No transactions' : txnCount + ' transaction' + (txnCount !== 1 ? 's' : '')}</div>
        <div class="bucket-visual-wrapper">
          <div class="bucket-handle"></div>
          <div class="bucket-rim"></div>
          <div class="bucket-visual ${fillPct >= 100 ? 'full' : ''}">
            <div class="bucket-fill" style="height:${Math.min(fillPct, 100)}%">
              ${waveSvg}
              <div class="bucket-fill-inner" style="background:linear-gradient(to top, ${fillColor}, ${fillColor}dd)"></div>
            </div>
            <span class="bucket-percent" style="color:${textColor}">${pct}%</span>
          </div>
        </div>
        <button class="swipe-actions-trigger" aria-label="Card actions">${icons.ellipsis}</button>
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
  const pool = activePool();
  openModal('Update Balance', `
    <div class="form-group">
      <label for="balance-input">Total Balance</label>
      <input type="number" id="balance-input" step="0.01" min="0" value="${pool.balance}" placeholder="0.00">
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
    state = await poolApi('PUT', '/balance', { balance: Math.round(val * 100) / 100 });
    closeModal();
    render();
    showToast('Balance updated');
  } catch (err) {
    document.getElementById('balance-error').textContent = err.message;
  }
}

// --- Create Bucket ---

function openNewBucket() {
  const pool = activePool();
  const colorButtons = COLORS.map((c, i) =>
    `<div class="color-option ${i === 0 ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`
  ).join('');

  if (pool.type === 'savings') {
    const usedPct = getTotalPercentage();
    const availPct = Math.round((100 - usedPct) * 100) / 100;

    openModal('New Bucket', `
      <div class="form-group">
        <label for="bucket-name">Name</label>
        <input type="text" id="bucket-name" placeholder="e.g. Taxes, Emergency Fund" maxlength="40">
      </div>
      <div class="form-group">
        <label for="bucket-pct">Percentage</label>
        <input type="number" id="bucket-pct" step="0.01" min="1" max="100" placeholder="30">
        <div class="hint">Available: ${availPct}%</div>
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
  } else {
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
  }
  document.getElementById('bucket-name').focus();
}

function selectColor(el) {
  document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function submitNewBucket() {
  const pool = activePool();
  const name = document.getElementById('bucket-name').value.trim();
  const color = document.querySelector('.color-option.selected')?.dataset.color || COLORS[0];

  if (!name) {
    document.getElementById('bucket-error').textContent = 'Name is required';
    return;
  }

  try {
    if (pool.type === 'savings') {
      const pct = parseFloat(document.getElementById('bucket-pct').value);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        document.getElementById('bucket-error').textContent = 'Enter a valid percentage (1-100)';
        return;
      }
      state = await poolApi('POST', '/buckets', { name, percentage: pct, color });
    } else {
      const target = parseFloat(document.getElementById('bucket-target').value);
      const alloc = parseFloat(document.getElementById('bucket-alloc').value) || 0;
      if (isNaN(target) || target < 0) {
        document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
        return;
      }
      state = await poolApi('POST', '/buckets', {
        name, targetAmount: Math.round(target * 100) / 100,
        allocatedAmount: Math.round(alloc * 100) / 100, color,
      });
    }
    closeModal();
    render();
    showToast(`"${name}" created`);
  } catch (err) {
    document.getElementById('bucket-error').textContent = err.message;
  }
}

// --- Edit Bucket ---

function openEditBucket(id) {
  const pool = activePool();
  const b = pool.buckets.find(x => x.id === id);
  if (!b) return;

  const colorButtons = COLORS.map(c =>
    `<div class="color-option ${c === b.color ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`
  ).join('');

  if (pool.type === 'savings') {
    const otherPct = pool.buckets.reduce((s, x) => s + (x.id !== id ? (x.percentage || 0) : 0), 0);
    const availPct = Math.round((100 - otherPct) * 100) / 100;

    openModal('Edit Bucket', `
      <div class="form-group">
        <label for="bucket-name">Name</label>
        <input type="text" id="bucket-name" value="${escHtml(b.name)}" maxlength="40">
      </div>
      <div class="form-group">
        <label for="bucket-pct">Percentage</label>
        <input type="number" id="bucket-pct" step="0.01" min="1" max="100" value="${b.percentage}">
        <div class="hint">Available: ${availPct}%</div>
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
  } else {
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
  }
  document.getElementById('bucket-name').focus();
}

async function submitEditBucket(id) {
  const pool = activePool();
  const name = document.getElementById('bucket-name').value.trim();
  const color = document.querySelector('.color-option.selected')?.dataset.color || COLORS[0];

  if (!name) {
    document.getElementById('bucket-error').textContent = 'Name is required';
    return;
  }

  try {
    if (pool.type === 'savings') {
      const pct = parseFloat(document.getElementById('bucket-pct').value);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        document.getElementById('bucket-error').textContent = 'Enter a valid percentage (1-100)';
        return;
      }
      state = await poolApi('PUT', `/buckets/${id}`, { name, percentage: pct, color });
    } else {
      const target = parseFloat(document.getElementById('bucket-target').value);
      if (isNaN(target) || target < 0) {
        document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
        return;
      }
      state = await poolApi('PUT', `/buckets/${id}`, {
        name, targetAmount: Math.round(target * 100) / 100, color,
      });
    }
    closeModal();
    render();
    showToast('Bucket updated');
  } catch (err) {
    document.getElementById('bucket-error').textContent = err.message;
  }
}

// --- Add/Remove Money ---

function openAddRemove(id) {
  const pool = activePool();
  const b = pool.buckets.find(x => x.id === id);
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
      state = await poolApi('POST', '/buckets/transfer', {
        fromId: 'unallocated', toId: id, amount: Math.round(amount * 100) / 100,
      });
    } else {
      state = await poolApi('POST', '/buckets/transfer', {
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
  const pool = activePool();
  const b = pool.buckets.find(x => x.id === id);
  if (!b) return;

  const refundMsg = pool.type === 'savings'
    ? `${b.percentage}% will be freed up for other buckets.`
    : `${fmt(b.allocatedAmount)} will return to your unallocated funds.`;

  openModal('Delete Bucket', `
    <p style="margin-bottom:0.5rem">Are you sure you want to delete <strong>${escHtml(b.name)}</strong>?</p>
    <p class="modal-subtitle" style="margin-bottom:1rem">${refundMsg}</p>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="submitDelete('${id}')">Delete</button>
    </div>
  `);
}

async function submitDelete(id) {
  try {
    state = await poolApi('DELETE', `/buckets/${id}`);
    closeModal();
    render();
    showToast('Bucket deleted');
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Transfer ---

function openTransfer() {
  const pool = activePool();
  if (pool.type === 'savings') {
    showToast('Transfers are not available for savings pools', true);
    return;
  }
  if (pool.buckets.length < 2) {
    showToast('Need at least 2 buckets to transfer', true);
    return;
  }

  const options = pool.buckets.map(b =>
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
    state = await poolApi('POST', '/buckets/transfer', {
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
    plaidStatus = { configured: false, linked: false, items: [], accounts: [] };
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

  const items = plaidStatus.items || [];
  const allAccounts = plaidStatus.accounts || [];
  const sandboxBtn = plaidStatus.sandbox
    ? `<button class="btn-sync" onclick="sandboxSetup()" id="sandbox-setup-btn">${icons.flask} Sandbox Quick Setup</button>`
    : '';

  if (!plaidStatus.linked) {
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
    // Build account list grouped by institution
    const accountList = items.map(item => {
      const itemAccounts = (item.accounts || []).map(a => {
        const icon = a.type === 'credit' ? icons.creditCard : icons.building;
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
      return `
        <div class="plaid-item-group">
          ${itemAccounts}
          <div class="plaid-account-row">
            <button class="btn-disconnect" onclick="disconnectBank('${item.itemId}')" title="Disconnect this institution">${icons.x} <span style="font-size:0.7rem;margin-left:0.2rem">Disconnect</span></button>
          </div>
        </div>
      `;
    }).join('');

    const lastSynced = state.plaid?.lastSynced
      ? 'Last synced: ' + new Date(state.plaid.lastSynced).toLocaleString()
      : 'Not yet synced';

    section.innerHTML = `
      <div class="plaid-status">
        <div class="plaid-info">
          <button class="plaid-accounts-toggle" onclick="this.parentElement.classList.toggle('open')">
            <span class="plaid-connected-dot"></span>
            <span class="plaid-connected-label">Connected Accounts (${allAccounts.length})</span>
            <span class="plaid-chevron">${icons.arrowRight}</span>
          </button>
          <div class="plaid-accounts-dropdown">
            ${accountList}
          </div>
          <span class="last-synced">${lastSynced}</span>
        </div>
        <div class="plaid-actions">
          <button class="btn-sync" id="sync-txn-btn" onclick="syncTransactions()">${icons.sync} Sync Transactions</button>
          <button class="btn-sync" id="sync-btn" onclick="syncBalance()">${icons.sync} Sync Balance</button>
          <button class="btn-link-bank" onclick="startPlaidLink()" style="font-size:0.78rem;padding:0.5rem 1rem">+ Add Account</button>
          ${sandboxBtn}
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

    localStorage.setItem('plaid_link_token', link_token);

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        try {
          await api('POST', '/api/plaid/exchange_token', { public_token });
          await fetchPlaidStatus();
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
    await api('POST', '/api/plaid/sandbox_setup');
    await fetchPlaidStatus();
    await fetchState();
    renderPlaidSection();
    showToast('Sandbox accounts linked — 1 checking + 1 credit card');
  } catch (err) {
    showToast(err.message, true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${icons.flask} Sandbox Quick Setup`;
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

async function disconnectBank(itemId) {
  if (!confirm('Disconnect this bank account? You can re-link later.')) return;

  try {
    const url = itemId ? `/api/plaid/disconnect?itemId=${encodeURIComponent(itemId)}` : '/api/plaid/disconnect';
    state = await api('DELETE', url);
    await fetchPlaidStatus();
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
  const pool = activePool();
  if (pool.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const isSavings = pool.type === 'savings';
  const bucketOptions = pool.buckets.map(b => {
    const label = isSavings
      ? `${escHtml(b.name)} (${b.percentage}%)`
      : `${escHtml(b.name)} (${fmt(b.allocatedAmount)} available)`;
    return `<option value="${b.id}" ${b.id === preselectedBucketId ? 'selected' : ''}>${label}</option>`;
  }).join('');

  const today = new Date().toISOString().split('T')[0];
  const title = isSavings ? 'Log Withdrawal' : 'Log Purchase';

  openModal(title, `
    <div class="form-group">
      <label for="txn-vendor">Vendor</label>
      <input type="text" id="txn-vendor" placeholder="e.g. Starbucks, Amazon" maxlength="80" oninput="checkAutoAssign()">
      <div class="hint" id="txn-auto-hint"></div>
    </div>
    <div class="form-group">
      <label for="txn-amount">Amount</label>
      <input type="number" id="txn-amount" step="0.01" min="0" placeholder="25.00">
      ${isSavings ? `<div class="hint">Balance: ${fmt(pool.balance)}</div>` : ''}
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
      <button class="btn-primary" onclick="submitTransaction()">${title}</button>
    </div>
  `);
  document.getElementById('txn-vendor').focus();
}

function checkAutoAssign() {
  const pool = activePool();
  const vendorInput = document.getElementById('txn-vendor').value.trim().toLowerCase();
  const hintEl = document.getElementById('txn-auto-hint');
  const bucketSelect = document.getElementById('txn-bucket');

  if (!vendorInput) {
    hintEl.textContent = '';
    return;
  }

  const rules = pool.autoAssignRules || [];
  const matchedRule = rules.find(r => vendorInput.includes(r.pattern));

  if (matchedRule) {
    const bucket = pool.buckets.find(b => b.id === matchedRule.bucketId);
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
    state = await poolApi('POST', '/transactions', {
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
  const pool = activePool();
  const listEl = document.getElementById('transaction-list');
  const emptyEl = document.getElementById('transactions-empty');
  const txns = (pool.transactions || [])
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
    const isDeposit = t.type === 'deposit';
    const bucket = pool.buckets.find(b => b.id === t.bucketId);
    const plaidBadge = t.source === 'plaid' ? `<span class="txn-plaid-badge" title="Imported from Plaid">${icons.link}</span>` : '';
    let bucketLabel;
    if (isDeposit) {
      const allocSummary = (t.allocations || []).map(a => {
        const bkt = pool.buckets.find(x => x.id === a.bucketId);
        return bkt ? `${escHtml(bkt.name)}: ${fmt(a.amount)}` : fmt(a.amount);
      }).join(', ');
      bucketLabel = `<span class="txn-bucket" style="color:var(--color-success)">${allocSummary || 'Deposit'}</span>`;
    } else if (t.bucketId && bucket) {
      bucketLabel = `<span class="txn-bucket"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bucket.color};margin-right:4px;vertical-align:middle"></span>${escHtml(bucket.name)}</span>`;
    } else if (t.bucketId && !bucket) {
      bucketLabel = '<span class="txn-bucket deleted">Deleted bucket</span>';
    } else {
      bucketLabel = `<span class="txn-bucket uncategorized">Uncategorized <button class="btn-assign" onclick="openAssignBucket('${t.id}')">Assign</button></span>`;
    }
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="txn-row ${!t.bucketId && !isDeposit ? 'txn-uncategorized' : ''}">
        <div class="txn-info">
          <span class="txn-vendor">${plaidBadge}${escHtml(t.vendor)}</span>
          ${t.note ? `<span class="txn-note">${escHtml(t.note)}</span>` : ''}
        </div>
        <div class="txn-meta">
          ${bucketLabel}
          <span class="txn-date">${dateStr}</span>
        </div>
        <div class="txn-amount" ${isDeposit ? 'style="color:var(--color-success)"' : ''}>
          ${isDeposit ? '+' : '-'}${fmt(t.amount)}
        </div>
        <button class="btn-icon txn-delete" onclick="deleteTransaction('${t.id}')" title="Delete">${icons.x}</button>
      </div>
    `;
  }).join('');

  if (txns.length > 20) {
    listEl.innerHTML += `<button class="btn-small txn-show-more" onclick="showAllTransactions()">Show all (${txns.length})</button>`;
  }
}

function showAllTransactions() {
  const pool = activePool();
  const txns = (pool.transactions || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = txns.map(t => {
    const isDeposit = t.type === 'deposit';
    const bucket = pool.buckets.find(b => b.id === t.bucketId);
    const plaidBadge = t.source === 'plaid' ? `<span class="txn-plaid-badge">${icons.link}</span>` : '';
    let bucketName;
    if (isDeposit) {
      const allocSummary = (t.allocations || []).map(a => {
        const bkt = pool.buckets.find(x => x.id === a.bucketId);
        return bkt ? escHtml(bkt.name) : '?';
      }).join(', ');
      bucketName = `<span style="color:var(--color-success)">${allocSummary || 'Deposit'}</span>`;
    } else if (t.bucketId && bucket) {
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
        <span class="txn-amount" ${isDeposit ? 'style="color:var(--color-success)"' : ''}>${isDeposit ? '+' : '-'}${fmt(t.amount)}</span>
        <span style="color:var(--text-secondary);font-size:0.8rem">${bucketName}</span>
        <span class="txn-date">${dateStr}</span>
        <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="Delete">${icons.x}</button>
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
  const pool = activePool();
  const bucket = pool.buckets.find(b => b.id === bucketId);
  if (!bucket) return;

  const txns = (pool.transactions || [])
    .filter(t => t.bucketId === bucketId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = txns.map(t => {
    const plaidBadge = t.source === 'plaid' ? `<span class="txn-plaid-badge">${icons.link}</span>` : '';
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="rule-row">
        <span class="txn-vendor" style="flex:1">${plaidBadge}${escHtml(t.vendor)}</span>
        <span class="txn-amount">-${fmt(t.amount)}</span>
        <span class="txn-date">${dateStr}</span>
        <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="Delete">${icons.x}</button>
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
  const pool = activePool();
  const txn = (pool.transactions || []).find(t => t.id === id);
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
    state = await poolApi('DELETE', `/transactions/${id}`);
    closeModal();
    render();
    showToast('Transaction deleted and refunded');
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Assign Uncategorized Transaction ---

function openAssignBucket(txnId) {
  const pool = activePool();
  const txn = (pool.transactions || []).find(t => t.id === txnId);
  if (!txn) return;

  if (pool.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const isSavings = pool.type === 'savings';
  const bucketOptions = pool.buckets.map(b => {
    const label = isSavings
      ? `${escHtml(b.name)} (${b.percentage}%)`
      : `${escHtml(b.name)} (${fmt(b.allocatedAmount)} available)`;
    return `<option value="${b.id}">${label}</option>`;
  }).join('');

  openModal('Assign to Bucket', `
    <p style="margin-bottom:1rem">
      <strong>${escHtml(txn.vendor)}</strong> &mdash; <span class="txn-amount">-${fmt(txn.amount)}</span>
    </p>
    <div class="form-group">
      <label for="assign-bucket">Bucket</label>
      <select id="assign-bucket">${bucketOptions}</select>
    </div>
    <div class="form-group" style="margin-bottom:0;overflow:hidden">
      <label style="display:block;text-transform:none;letter-spacing:normal;font-size:0.8rem;color:var(--text-secondary);line-height:1.4">
        <input type="checkbox" id="assign-create-rule" style="vertical-align:middle;margin-right:0.4rem">
        <span style="vertical-align:middle">Also create auto-assign rule for "${escHtml(txn.vendor)}"</span>
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
  const pool = activePool();
  const bucketId = document.getElementById('assign-bucket').value;
  const createRule = document.getElementById('assign-create-rule').checked;
  const txn = (pool.transactions || []).find(t => t.id === txnId);

  try {
    state = await poolApi('PUT', `/transactions/${txnId}/assign`, { bucketId });

    if (createRule && txn) {
      try {
        state = await poolApi('POST', '/auto-assign-rules', {
          pattern: txn.vendor.toLowerCase(),
          bucketId,
        });
      } catch (ruleErr) {
        console.warn('Could not create rule:', ruleErr.message);
      }
    }

    closeModal();
    render();
    const bucket = pool.buckets.find(b => b.id === bucketId);
    showToast(`Assigned to ${bucket ? bucket.name : 'bucket'}`);
  } catch (err) {
    const errEl = document.getElementById('assign-error');
    if (errEl) errEl.textContent = err.message;
  }
}

// --- Auto-Assign Rules ---

function openManageRules() {
  const pool = activePool();
  const rules = pool.autoAssignRules || [];

  const bucketOptions = pool.buckets.map(b =>
    `<option value="${b.id}">${escHtml(b.name)}</option>`
  ).join('');

  const ruleRows = rules.length > 0
    ? rules.map(r => {
        const bucket = pool.buckets.find(b => b.id === r.bucketId);
        const bucketName = bucket ? escHtml(bucket.name) : 'Deleted bucket';
        return `
          <div class="rule-row">
            <span class="rule-pattern">"${escHtml(r.pattern)}"</span>
            <span class="rule-arrow">${icons.arrowRight}</span>
            <span class="rule-bucket">${bucketName}</span>
            <button class="btn-icon" onclick="deleteRule('${r.id}')" title="Delete">${icons.x}</button>
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
    state = await poolApi('POST', '/auto-assign-rules', { pattern, bucketId });
    render();
    showToast('Rule added');
    openManageRules();
  } catch (err) {
    document.getElementById('rule-error').textContent = err.message;
  }
}

async function deleteRule(id) {
  try {
    state = await poolApi('DELETE', `/auto-assign-rules/${id}`);
    render();
    showToast('Rule deleted');
    openManageRules();
  } catch (err) {
    showToast(err.message, true);
  }
}

// --- Event Listeners ---

document.getElementById('edit-balance-btn').addEventListener('click', openEditBalance);
document.getElementById('new-bucket-btn').addEventListener('click', openNewBucket);
document.getElementById('transfer-btn').addEventListener('click', openTransfer);
document.getElementById('log-purchase-btn').addEventListener('click', () => openLogPurchase(null));
document.getElementById('log-deposit-btn').addEventListener('click', openLogDeposit);
document.getElementById('manage-rules-btn').addEventListener('click', openManageRules);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { SwipeController.closeAll(); closeModal(); }
  if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
    const primaryBtn = document.querySelector('#modal-body .btn-primary');
    if (primaryBtn) primaryBtn.click();
  }
});

// --- PWA Install Hint (iOS Safari) ---

function showInstallHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('pwa-hint-dismissed');

  if (!isIOS || isStandalone || dismissed) return;

  const hint = document.createElement('div');
  hint.className = 'pwa-install-hint';
  hint.innerHTML = `
    <span class="pwa-install-hint-icon">${icons.phone}</span>
    <span class="pwa-install-hint-text">
      <strong>Install Bucket Budget:</strong> tap the share button
      ${icons.share} then <strong>"Add to Home Screen"</strong>
    </span>
    <button class="pwa-install-hint-close" onclick="dismissInstallHint()">${icons.x}</button>
  `;
  document.body.appendChild(hint);
}

function dismissInstallHint() {
  localStorage.setItem('pwa-hint-dismissed', '1');
  const hint = document.querySelector('.pwa-install-hint');
  if (hint) hint.remove();
}

// --- Init ---
fetchState();
fetchPlaidStatus();
showInstallHint();
SwipeController.init();
document.getElementById('manage-rules-btn').innerHTML = icons.rules + ' Auto-Assign Rules';
