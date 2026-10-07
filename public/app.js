// --- State ---
let state = { pools: [], activePoolId: null };
let plaidStatus = { configured: false, linked: false, items: [], accounts: [], sandbox: false };
let txnFilter = 'outgoing'; // 'outgoing' | 'income'
let txnListExpanded = false;
let plaidAccountsOpen = false;
let authEnabled = false; // server has a password set
let authLocked = false;  // login modal is showing
let pendingMutations = 0;

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
  undo: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  lock: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

// --- Swipe Controller ---

const SwipeController = {
  THRESHOLD: 80,
  VELOCITY_THRESHOLD: 0.3,
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
    const txnList = document.getElementById('transaction-list');
    const regions = [grid, txnList].filter(Boolean);
    if (regions.length === 0) return;

    for (const region of regions) {
      region.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
      region.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      region.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
      region.addEventListener('mousedown', (e) => this.handleMouseDown(e));
      region.addEventListener('click', (e) => {
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
    }

    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    document.addEventListener('click', (e) => {
      if (this.activeCard && !this.activeCard.contains(e.target)) {
        this.closeAll();
      }
    });
  },

  getSwipeContent(card) {
    return card.querySelector('.swipe-content');
  },

  // How far the content slides to reveal each side's actions (0 when a side has none)
  getOpenOffsets(card) {
    const right = card.querySelector('.swipe-actions-right');
    const left = card.querySelector('.swipe-actions-left');
    return { min: right ? -right.offsetWidth : 0, max: left ? left.offsetWidth : 0 };
  },

  getExistingOffset(card) {
    const s = card.dataset.swipeState;
    const { min, max } = this.getOpenOffsets(card);
    if (s === 'left') return min;
    if (s === 'right') return max;
    return 0;
  },

  dragTo(dx) {
    const card = this.currentCard;
    const { min, max } = this.getOpenOffsets(card);
    let offset = dx + this.getExistingOffset(card);
    if (offset < min) offset = min < 0 ? min + (offset - min) * 0.2 : 0;
    if (offset > max) offset = max > 0 ? max + (offset - max) * 0.2 : 0;
    this.currentDx = dx;
    this.getSwipeContent(card).style.transform = `translateX(${offset}px)`;
  },

  finishDrag(clickTarget) {
    const card = this.currentCard;
    this.getSwipeContent(card).classList.remove('dragging');

    const elapsed = Date.now() - this.startTime;
    const velocity = Math.abs(this.currentDx) / elapsed;
    const dx = this.currentDx;

    if (dx < 0 && (Math.abs(dx) > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(card, 'left');
    } else if (dx > 0 && (dx > this.THRESHOLD || velocity > this.VELOCITY_THRESHOLD)) {
      this.openCard(card, 'right');
    } else {
      this.closeCard(card);
    }

    // Prevent accidental click after swipe
    const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    clickTarget.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => clickTarget.removeEventListener('click', swallowClick, true), 300);

    this.currentCard = null;
    this.isDragging = false;
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

    this.dragTo(dx);
  },

  handleTouchEnd() {
    if (!this.currentCard || !this.isDragging) { this.currentCard = null; return; }
    this.finishDrag(this.currentCard);
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

    this.dragTo(dx);
  },

  handleMouseUp() {
    if (!this.currentCard || !this.isDragging) { this.currentCard = null; return; }
    // The click after a drag lands on a common ancestor if the pointer left the card
    this.finishDrag(document);
  },

  openCard(card, direction) {
    const { min, max } = this.getOpenOffsets(card);
    const offset = direction === 'left' ? min : max;
    if (offset === 0) { this.closeCard(card); return; }
    this.getSwipeContent(card).style.transform = `translateX(${offset}px)`;
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
    const txnId = btn.dataset.txnId;
    const poolId = btn.dataset.poolId;
    this.closeAll();
    switch (action) {
      case 'spend': openLogPurchase(bucketId); break;
      case 'edit': openEditBucket(bucketId); break;
      case 'funds': openAddRemove(bucketId); break;
      case 'delete': openDeleteBucket(bucketId); break;
      case 'txn-delete': deleteTransaction(txnId); break;
      case 'income': openMarkIncomeModal(poolId, txnId); break;
      case 'transfer-in': markTransferIn(poolId, txnId); break;
      case 'transfer-in-undo': undoTransferIn(poolId, txnId); break;
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
  const isMutation = method !== 'GET';
  // Block modal buttons while a change is in flight so double-clicks can't repeat it
  if (isMutation) {
    pendingMutations++;
    setModalButtonsBusy(true);
  }
  try {
    let res;
    try {
      res = await fetch(path, opts);
    } catch (err) {
      throw new Error('Network error — check your connection');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      // Not JSON (e.g. a proxy error page)
    }
    if (res.status === 401 && data?.authRequired) {
      showLogin();
      const authErr = new Error(data.error || 'Authentication required');
      authErr.authRequired = true;
      throw authErr;
    }
    if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
    if (data === null) throw new Error('Unexpected response from server');
    return data;
  } finally {
    if (isMutation && --pendingMutations === 0) setModalButtonsBusy(false);
  }
}

function setModalButtonsBusy(busy) {
  document.querySelectorAll('#modal-body button').forEach(btn => {
    if (busy && !btn.disabled) {
      btn.disabled = true;
      btn.dataset.busy = '1';
    } else if (!busy && btn.dataset.busy) {
      btn.disabled = false;
      delete btn.dataset.busy;
    }
  });
}

function poolApi(method, path, body) {
  const pool = activePool();
  if (!pool.id) return Promise.reject(new Error('Create a pool first'));
  return api(method, `/api/pools/${pool.id}${path}`, body);
}

// Shows an error in the given form-error element (falling back to a toast).
// Auth errors are skipped — the login modal is already up.
function showError(err, errorElId) {
  if (err?.authRequired) return;
  const el = errorElId && document.getElementById(errorElId);
  if (el) el.textContent = err.message;
  else showToast(err.message, true);
}

function requireActivePool() {
  if (activePool().id) return true;
  showToast('Create a pool first', true);
  openNewPool();
  return false;
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
    showError(err);
  }
}

// --- Formatting ---

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(n);
}

// Today as YYYY-MM-DD in local time (for date inputs)
function todayInputValue() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Transaction dates are stored as UTC midnight, so format them in UTC
function fmtTxnDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  if (d.getUTCFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function txnTime(value) {
  const t = Date.parse(value);
  return isNaN(t) ? 0 : t;
}

// Newest first; same-day entries by when they were logged
function compareTxnsNewestFirst(a, b) {
  return (txnTime(b.date) - txnTime(a.date)) || (txnTime(b.createdAt) - txnTime(a.createdAt));
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
  // Linked items come with every state response; configured/sandbox only from /api/plaid/status
  plaidStatus.linked = !!state.plaid?.linked;
  plaidStatus.items = state.plaid?.items || [];
  plaidStatus.accounts = state.plaid?.accounts || [];

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

  nav.innerHTML = state.pools.map(p => {
    const isActive = p.id === state.activePoolId;
    const typeBadge = p.type === 'savings' ? '<span class="pool-tab-badge">%</span>'
      : (p.type === 'goal-savings' ? '<span class="pool-tab-badge">G</span>' : '');
    const editBtn = isActive ? `<span class="pool-tab-edit" onclick="event.stopPropagation();openEditPool()" title="Edit pool">${icons.pencil}</span>` : '';
    return `<button class="pool-tab ${isActive ? 'active' : ''}" onclick="switchPool('${p.id}')">
      <span class="pool-tab-name">${escHtml(p.name)}</span>
      ${typeBadge}
      ${editBtn}
    </button>`;
  }).join('') +
    `<button class="pool-tab pool-tab-add" onclick="openNewPool()" title="New Pool">${icons.plus}</button>`;
}

async function switchPool(poolId) {
  if (poolId === state.activePoolId) return;
  try {
    txnListExpanded = false;
    state = await api('PUT', `/api/pools/${poolId}/active`);
    render();
  } catch (err) {
    showError(err);
  }
}

function renderLinkedAccountsField(currentPoolId, selectedIds, balanceIds) {
  if (!plaidStatus.configured || !plaidStatus.linked) return '';
  const items = plaidStatus.items || [];
  if (items.length === 0) return '';

  const selected = new Set(selectedIds || []);
  const balanceSet = new Set(balanceIds || []);
  const linkedElsewhere = {};
  for (const p of state.pools) {
    if (p.id === currentPoolId) continue;
    for (const id of (p.linkedAccountIds || [])) linkedElsewhere[id] = p.name;
  }

  const rows = items.flatMap(item => (item.accounts || []).map(a => {
    const checked = selected.has(a.id);
    const isBalance = balanceSet.has(a.id);
    const safeId = escHtml(a.id);
    const label = `${a.name}${a.mask ? ' ····' + a.mask : ''}`;
    const typeLabel = a.type === 'credit' ? 'Credit Card'
      : (a.subtype === 'checking' ? 'Checking'
      : (a.subtype === 'savings' ? 'Savings'
      : (a.subtype === 'cash management' ? 'Cash' : 'Account')));
    const conflict = linkedElsewhere[a.id];
    const linkId = `link-${safeId}`;
    const balId = `bal-${safeId}`;
    return `
      <div class="account-link-item${checked ? ' selected' : ''}">
        <label class="account-link-main" for="${linkId}">
          <input type="checkbox" class="account-link-checkbox" id="${linkId}" value="${safeId}" ${checked ? 'checked' : ''} onchange="onLinkCheckboxChange(this)">
          <span class="account-link-info">
            <span class="account-link-name">${escHtml(label)}</span>
            <span class="account-link-type">${typeLabel}${item.institutionName ? ` · ${escHtml(item.institutionName)}` : ''}${conflict ? ` · also in "${escHtml(conflict)}"` : ''}</span>
          </span>
        </label>
        <label class="account-balance-toggle" for="${balId}" title="Include this account in the pool's total balance">
          <input type="checkbox" class="account-balance-checkbox" id="${balId}" value="${safeId}" ${isBalance ? 'checked' : ''} ${checked ? '' : 'disabled'}>
          <span aria-hidden="true">$</span>
        </label>
      </div>
    `;
  })).join('');

  return `
    <div class="form-group">
      <label>Linked Bank Accounts</label>
      <p class="hint" style="font-size:0.75rem;color:var(--text-secondary);margin:0 0 0.5rem 0">Check to sync transactions. Tap <strong>$</strong> to include an account in the pool's total balance.</p>
      <div class="account-link-list">${rows}</div>
    </div>
  `;
}

function onLinkCheckboxChange(cb) {
  const row = cb.closest('.account-link-item');
  if (row) row.classList.toggle('selected', cb.checked);
  // If unlinking, also uncheck the balance toggle and disable it
  const balanceCb = row?.querySelector('.account-balance-checkbox');
  if (balanceCb) {
    balanceCb.disabled = !cb.checked;
    if (!cb.checked) balanceCb.checked = false;
  }
}

function getCheckedAccountIds() {
  return Array.from(document.querySelectorAll('.account-link-checkbox:checked')).map(cb => cb.value);
}

function getCheckedBalanceAccountIds() {
  return Array.from(document.querySelectorAll('.account-balance-checkbox:checked:not(:disabled)')).map(cb => cb.value);
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
        <label class="pool-type-option" onclick="selectPoolType(this, 'goal-savings')">
          <input type="radio" name="pool-type" value="goal-savings" style="display:none">
          <span class="pool-type-icon">${icons.bucket}</span>
          <span class="pool-type-label">Goal Savings</span>
          <span class="pool-type-desc">Target goals filled by transfers</span>
        </label>
      </div>
    </div>
    ${renderLinkedAccountsField(null, [], [])}
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
  const linkedAccountIds = getCheckedAccountIds();
  const balanceAccountIds = getCheckedBalanceAccountIds();

  if (!name) {
    document.getElementById('pool-error').textContent = 'Name is required';
    return;
  }

  try {
    state = await api('POST', '/api/pools', { name, type, linkedAccountIds, balanceAccountIds });
    closeModal();
    render();
    showToast(`"${name}" pool created`);
  } catch (err) {
    showError(err, 'pool-error');
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
      <p style="color:var(--text-secondary);font-size:0.9rem">${pool.type === 'savings' ? 'Savings (percentage-based)' : pool.type === 'goal-savings' ? 'Goal Savings (target-based)' : 'Spending (dollar-based)'}</p>
    </div>
    ${renderLinkedAccountsField(pool.id, pool.linkedAccountIds || [], pool.balanceAccountIds || pool.linkedAccountIds || [])}
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
  const linkedAccountIds = getCheckedAccountIds();
  const balanceAccountIds = getCheckedBalanceAccountIds();

  try {
    state = await api('PUT', `/api/pools/${poolId}`, { name, linkedAccountIds, balanceAccountIds });
    closeModal();
    render();
    showToast('Pool updated');
  } catch (err) {
    showError(err, 'pool-error');
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
    showError(err);
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
  if (!requireActivePool()) return;
  const pool = activePool();
  if (pool.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  const today = todayInputValue();

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
      date: date || todayInputValue(),
      note,
    });
    closeModal();
    render();
    showToast(`${fmt(depositAmount)} deposited`);
  } catch (err) {
    showError(err, 'deposit-error');
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

function renderTopOffButton(b) {
  if (typeof b.targetAmount !== 'number') return '';
  const gap = Math.round((b.targetAmount - (b.allocatedAmount || 0)) * 100) / 100;
  if (gap <= 0) return '';
  const unallocated = Math.round(getUnallocated() * 100) / 100;
  if (unallocated <= 0) return '';
  const fillAmount = Math.min(gap, unallocated);
  const partial = fillAmount < gap;
  return `<button class="bucket-topoff-btn${partial ? ' partial' : ''}" onclick="event.stopPropagation();topOffBucket('${b.id}', this)" title="${partial ? 'Partial fill — not enough unallocated' : 'Fill to target'}">
    ${icons.droplet}
    <span>Top off ${fmt(fillAmount)}</span>
  </button>`;
}

async function topOffBucket(id, btn) {
  const pool = activePool();
  const b = pool.buckets.find(x => x.id === id);
  if (!b) return;
  const gap = Math.round((b.targetAmount - (b.allocatedAmount || 0)) * 100) / 100;
  const unallocated = Math.round(getUnallocated() * 100) / 100;
  const amount = Math.round(Math.min(gap, unallocated) * 100) / 100;
  if (amount <= 0) {
    showToast(gap <= 0 ? 'Bucket is already full' : 'No unallocated funds to use', true);
    return;
  }
  if (btn) btn.disabled = true;
  try {
    state = await poolApi('POST', '/buckets/transfer', {
      fromId: 'unallocated', toId: id, amount,
    });
    render();
    showToast(`Added ${fmt(amount)} to ${b.name}${amount < gap ? ' (partial)' : ''}`);
  } catch (err) {
    if (btn) btn.disabled = false;
    showError(err);
  }
}

function renderBucketCard(b) {
  const pool = activePool();
  const allocated = b.allocatedAmount || 0;
  const isOverdrawn = allocated < 0;
  // Overdrawn buckets show an empty vessel rather than a negative fill
  const fillPct = b.targetAmount > 0
    ? Math.max(0, Math.min((allocated / b.targetAmount) * 100, 150))
    : (allocated > 0 ? 100 : 0);
  const displayPct = b.targetAmount > 0
    ? Math.max(0, Math.round((allocated / b.targetAmount) * 100))
    : (allocated > 0 ? 100 : 0);
  const isFull = fillPct === 100;
  const isOver = fillPct > 100;

  const visualClass = isOver ? 'over' : (isFull ? 'full' : '');
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
    <div class="bucket-card swipe-container${isOverdrawn ? ' overdrawn' : ''}" data-id="${b.id}">
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
            ${b.isTax ? '<span class="bucket-tax-badge" title="Tax bucket">TAX</span>' : ''}
          </div>
        </div>
        <div class="bucket-amounts">
          <strong${isOverdrawn ? ' class="amount-negative"' : ''}>${fmt(b.allocatedAmount)}</strong> / ${fmt(b.targetAmount)}
        </div>
        ${renderTopOffButton(b)}
        <div class="bucket-txn-count" onclick="openBucketTransactions('${b.id}')">${txnCount === 0 ? 'No transactions' : txnCount + ' transaction' + (txnCount !== 1 ? 's' : '')}</div>
        <div class="bucket-visual-wrapper">
          <div class="bucket-handle"></div>
          <div class="bucket-rim"></div>
          <div class="bucket-visual ${visualClass}">
            <div class="bucket-fill" style="height:${Math.min(fillPct, 100)}%">
              ${waveSvg}
              <div class="bucket-fill-inner" style="background:linear-gradient(to top, ${fillColor}, ${fillColor}dd)"></div>
            </div>
            <span class="bucket-percent" style="color:var(--text-primary)">${displayPct}%</span>
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
  const isOverdrawn = accumulated < 0;
  const fillPct = poolBalance > 0 ? Math.max(0, Math.min((accumulated / poolBalance) * 100, 100)) : 0;
  const fillColor = b.color;

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
    <div class="bucket-card swipe-container${isOverdrawn ? ' overdrawn' : ''}" data-id="${b.id}">
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
          <strong${isOverdrawn ? ' class="amount-negative"' : ''}>${fmt(accumulated)}</strong>
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
            <span class="bucket-percent" style="color:var(--text-primary)">${pct}%</span>
          </div>
        </div>
        <button class="swipe-actions-trigger" aria-label="Card actions">${icons.ellipsis}</button>
      </div>
    </div>
  `;
}

// Safe for both text and attribute values
function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Modal ---

function openModal(title, bodyHtml) {
  if (authLocked) return; // the login modal stays put until unlocked
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  if (authLocked) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// --- Toast ---

function showToast(msg, isError, duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// --- Balance ---

function openEditBalance() {
  if (!requireActivePool()) return;
  const pool = activePool();
  const fromLinkedAccounts = (pool.balanceAccountIds || pool.linkedAccountIds || []).length > 0;
  openModal('Update Balance', `
    <div class="form-group">
      <label for="balance-input">Total Balance</label>
      <input type="number" id="balance-input" step="0.01" value="${pool.balance}" placeholder="0.00">
      ${fromLinkedAccounts ? '<div class="hint">This pool\'s balance comes from linked accounts — Sync Balance will overwrite manual edits.</div>' : ''}
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
  // Negative is fine — e.g. a pool whose card debt exceeds its cash
  if (!Number.isFinite(val)) {
    document.getElementById('balance-error').textContent = 'Enter a valid number';
    return;
  }
  try {
    state = await poolApi('PUT', '/balance', { balance: Math.round(val * 100) / 100 });
    closeModal();
    render();
    showToast('Balance updated');
  } catch (err) {
    showError(err, 'balance-error');
  }
}

// --- Create Bucket ---

function openNewBucket() {
  if (!requireActivePool()) return;
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
        <label>Bucket Kind</label>
        <div class="pool-type-options">
          <label class="pool-type-option selected" onclick="selectBucketKind(this, 'normal')">
            <input type="radio" name="bucket-kind" value="normal" checked style="display:none">
            <span class="pool-type-icon">${icons.bucket}</span>
            <span class="pool-type-label">Normal</span>
            <span class="pool-type-desc">Regular spending or savings goal</span>
          </label>
          <label class="pool-type-option" onclick="selectBucketKind(this, 'tax')">
            <input type="radio" name="bucket-kind" value="tax" style="display:none">
            <span class="pool-type-icon">${icons.receipt}</span>
            <span class="pool-type-label">Tax</span>
            <span class="pool-type-desc">Grows when income is marked</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label for="bucket-name">Name</label>
        <input type="text" id="bucket-name" placeholder="e.g. Dining Out" maxlength="40">
      </div>
      <div class="form-group">
        <label for="bucket-target">Target Amount</label>
        <input type="number" id="bucket-target" step="0.01" min="0" placeholder="100.00">
        <div class="hint" id="bucket-target-hint">Tax buckets typically start at $0 and grow as income is tagged.</div>
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

function selectBucketKind(el, kind) {
  document.querySelectorAll('[name="bucket-kind"]').forEach(r => {
    r.closest('.pool-type-option').classList.remove('selected');
  });
  el.classList.add('selected');
  el.querySelector('input').checked = true;
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
      const kindInput = document.querySelector('input[name="bucket-kind"]:checked');
      const isTax = (kindInput?.value || 'normal') === 'tax';
      if (isNaN(target) || target < 0) {
        document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
        return;
      }
      state = await poolApi('POST', '/buckets', {
        name, targetAmount: Math.round(target * 100) / 100,
        allocatedAmount: Math.round(alloc * 100) / 100, color, isTax,
      });
    }
    closeModal();
    render();
    showToast(`"${name}" created`);
  } catch (err) {
    showError(err, 'bucket-error');
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
    const isTax = !!b.isTax;
    openModal('Edit Bucket', `
      <div class="form-group">
        <label>Bucket Kind</label>
        <div class="pool-type-options">
          <label class="pool-type-option ${isTax ? '' : 'selected'}" onclick="selectBucketKind(this, 'normal')">
            <input type="radio" name="bucket-kind" value="normal" ${isTax ? '' : 'checked'} style="display:none">
            <span class="pool-type-icon">${icons.bucket}</span>
            <span class="pool-type-label">Normal</span>
            <span class="pool-type-desc">Regular spending or savings goal</span>
          </label>
          <label class="pool-type-option ${isTax ? 'selected' : ''}" onclick="selectBucketKind(this, 'tax')">
            <input type="radio" name="bucket-kind" value="tax" ${isTax ? 'checked' : ''} style="display:none">
            <span class="pool-type-icon">${icons.receipt}</span>
            <span class="pool-type-label">Tax</span>
            <span class="pool-type-desc">Grows when income is marked</span>
          </label>
        </div>
      </div>
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
      const kindInput = document.querySelector('input[name="bucket-kind"]:checked');
      const isTax = (kindInput?.value || 'normal') === 'tax';
      if (isNaN(target) || target < 0) {
        document.getElementById('bucket-error').textContent = 'Enter a valid target amount';
        return;
      }
      state = await poolApi('PUT', `/buckets/${id}`, {
        name, targetAmount: Math.round(target * 100) / 100, color, isTax,
      });
    }
    closeModal();
    render();
    showToast('Bucket updated');
  } catch (err) {
    showError(err, 'bucket-error');
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
    showError(err, 'addremove-error');
  }
}

// --- Delete Bucket ---

function openDeleteBucket(id) {
  const pool = activePool();
  const b = pool.buckets.find(x => x.id === id);
  if (!b) return;

  let refundMsg = pool.type === 'savings'
    ? `${b.percentage}% will be freed up for other buckets.`
    : (b.allocatedAmount < 0
      ? `Its ${fmt(-b.allocatedAmount)} overdraft will come out of your unallocated funds.`
      : `${fmt(b.allocatedAmount)} will return to your unallocated funds.`);
  const ruleCount = (pool.autoAssignRules || []).filter(r => r.bucketId === id).length;
  if (ruleCount > 0) refundMsg += ` Its ${ruleCount} auto-assign rule${ruleCount === 1 ? '' : 's'} will be deleted too.`;

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
    showError(err);
  }
}

// --- Transfer ---

function openTransfer() {
  if (!requireActivePool()) return;
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
    showError(err, 'transfer-error');
  }
}

// --- Plaid ---

async function fetchPlaidStatus() {
  try {
    plaidStatus = await api('GET', '/api/plaid/status');
  } catch (err) {
    plaidStatus = { configured: false, linked: false, items: [], accounts: [], sandbox: false };
  }
  renderPlaidSection();
}

function togglePlaidAccounts(btn) {
  plaidAccountsOpen = !plaidAccountsOpen;
  btn.parentElement.classList.toggle('open', plaidAccountsOpen);
  btn.setAttribute('aria-expanded', plaidAccountsOpen);
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
      const itemError = item.needsReauth
        ? `<div class="plaid-item-error">${escHtml(item.error || 'Bank login expired')} <button class="btn-assign" onclick="reconnectItem('${item.itemId}')">Reconnect</button></div>`
        : (item.error ? `<div class="plaid-item-error">${escHtml(item.error)}</div>` : '');
      return `
        <div class="plaid-item-group">
          <div class="plaid-item-header">
            <span class="plaid-item-name">${escHtml(item.institutionName || 'Bank')}</span>
            <button class="btn-disconnect" onclick="disconnectBank('${item.itemId}')" title="Disconnect this institution">${icons.x} <span style="font-size:0.7rem;margin-left:0.2rem">Disconnect</span></button>
          </div>
          ${itemError}
          ${itemAccounts}
        </div>
      `;
    }).join('');

    const attentionCount = items.filter(item => item.needsReauth || item.error).length;
    const lastSynced = state.plaid?.lastSynced
      ? 'Last synced: ' + new Date(state.plaid.lastSynced).toLocaleString()
      : 'Not yet synced';

    section.innerHTML = `
      <div class="plaid-status">
        <div class="plaid-info${plaidAccountsOpen ? ' open' : ''}">
          <button class="plaid-accounts-toggle" onclick="togglePlaidAccounts(this)" aria-expanded="${plaidAccountsOpen}">
            <span class="plaid-connected-dot${attentionCount ? ' attention' : ''}"></span>
            <span class="plaid-connected-label">Connected Accounts (${allAccounts.length})</span>
            ${attentionCount ? `<span class="plaid-attention">${attentionCount} need${attentionCount === 1 ? 's' : ''} attention</span>` : ''}
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
    localStorage.removeItem('plaid_update_item_id');

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        try {
          await api('POST', '/api/plaid/exchange_token', {
            public_token,
            institutionName: metadata?.institution?.name,
          });
          await afterAccountLinked();
        } catch (err) {
          showError(err);
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
    showError(err);
  }
}

// New accounts belong to no pool (so a sync would import nothing) — let the user attach them
async function afterAccountLinked() {
  await fetchPlaidStatus();
  await fetchState();
  if (authLocked) return;
  showToast('Account linked — choose which pool uses it');
  if (activePool().id) openEditPool();
  else openNewPool();
}

// Update mode: the user logs in to the bank again; the item keeps its access token,
// so the public token is NOT exchanged
async function reconnectItem(itemId) {
  if (typeof Plaid === 'undefined') {
    showToast('Plaid Link script not loaded. Check your internet connection.', true);
    return;
  }

  try {
    const { link_token } = await api('POST', '/api/plaid/create_link_token', { itemId });

    localStorage.setItem('plaid_link_token', link_token);
    localStorage.setItem('plaid_update_item_id', itemId);

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async () => {
        localStorage.removeItem('plaid_update_item_id');
        try {
          state = await api('POST', `/api/plaid/items/${encodeURIComponent(itemId)}/reconnected`);
          render();
          showToast('Reconnected — sync to fetch new transactions');
        } catch (err) {
          showError(err);
        }
      },
      onExit: (err) => {
        localStorage.removeItem('plaid_update_item_id');
        if (err) {
          console.error('Plaid Link exit error:', err);
        }
      },
    });

    handler.open();
  } catch (err) {
    showError(err);
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
    await afterAccountLinked();
  } catch (err) {
    showError(err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${icons.flask} Sandbox Quick Setup`;
    }
  }
}

// e.g. "Couldn't sync First Platypus Bank — reconnect required"
function describeFailedItems(failedItems) {
  const parts = failedItems.map(f => {
    const name = f.institutionName || 'Bank';
    if (f.needsReauth) return `${name} — reconnect required`;
    return f.error ? `${name} (${f.error})` : name;
  });
  return `Couldn't sync ${parts.join('; ')}`;
}

async function syncBalance() {
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
  }

  try {
    const result = await api('POST', '/api/plaid/sync_balance');
    const summary = result.balanceSummary || {};
    delete result.balanceSummary;
    const failed = summary.failedItems || [];
    if (failed.some(f => f.needsReauth)) plaidAccountsOpen = true; // reveal the Reconnect buttons
    state = result;
    render();

    const updated = summary.updatedPools;
    if (failed.length === 0 || updated > 0) {
      showToast(typeof updated === 'number'
        ? `Balance synced for ${updated} pool${updated === 1 ? '' : 's'}`
        : 'Balance synced from bank');
    }
    if (failed.length > 0) showToast(describeFailedItems(failed), true, 6000);
  } catch (err) {
    showError(err);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `${icons.sync} Sync Balance`;
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
    showError(err);
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
    const summary = result.syncSummary || {};
    delete result.syncSummary;
    const failed = summary.failedItems || [];
    if (failed.some(f => f.needsReauth)) plaidAccountsOpen = true; // reveal the Reconnect buttons
    state = result;
    render();

    if (summary.added || summary.modified || summary.removed) {
      openSyncSummaryModal(summary);
    } else if (failed.length < plaidStatus.items.length) {
      showToast('No new transactions to import');
    }
    if (failed.length > 0) showToast(describeFailedItems(failed), true, 6000);
  } catch (err) {
    showError(err);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `${icons.sync} Sync Transactions`;
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
  if (!requireActivePool()) return;
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

  const today = todayInputValue();
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

// Same matching as the server: case-insensitive substring, longest pattern wins,
// rules whose bucket no longer exists are ignored
function findAutoAssignRule(pool, vendor) {
  const vendorLower = (vendor || '').trim().toLowerCase();
  if (!vendorLower) return null;
  let best = null;
  for (const rule of pool.autoAssignRules || []) {
    const pattern = (rule.pattern || '').toLowerCase();
    if (!pattern || !vendorLower.includes(pattern)) continue;
    if (!pool.buckets.some(b => b.id === rule.bucketId)) continue;
    if (!best || pattern.length > best.pattern.length) best = rule;
  }
  return best;
}

function checkAutoAssign() {
  const pool = activePool();
  const hintEl = document.getElementById('txn-auto-hint');
  const bucketSelect = document.getElementById('txn-bucket');
  const matchedRule = findAutoAssignRule(pool, document.getElementById('txn-vendor').value);

  if (matchedRule) {
    const bucket = pool.buckets.find(b => b.id === matchedRule.bucketId);
    bucketSelect.value = matchedRule.bucketId;
    hintEl.textContent = `Auto-assigned to ${bucket.name}`;
    hintEl.style.color = 'var(--color-success)';
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
      date: date || todayInputValue(),
    });
    closeModal();
    render();
    showToast(`${fmt(amount)} spent at ${vendor}`);
  } catch (err) {
    showError(err, 'txn-error');
  }
}

// --- Transaction History ---

function findIncomeTargetLabel(txnOrAlloc) {
  // Accepts either a single alloc (legacy) or a transaction (to read .incomeAllocations / .incomeAllocation)
  const allocs = Array.isArray(txnOrAlloc?.incomeAllocations) && txnOrAlloc.incomeAllocations.length > 0
    ? txnOrAlloc.incomeAllocations
    : (txnOrAlloc?.targetPoolId
        ? [txnOrAlloc]
        : (txnOrAlloc?.incomeAllocation ? [txnOrAlloc.incomeAllocation] : []));
  if (allocs.length === 0) return '';
  if (allocs.length === 1) {
    const a = allocs[0];
    const targetPool = state.pools.find(p => p.id === a.targetPoolId);
    const targetBucket = targetPool?.buckets.find(b => b.id === a.targetBucketId);
    if (!targetBucket) return fmt(a.amount);
    return `${fmt(a.amount)} → ${escHtml(targetBucket.name)}`;
  }
  const total = Math.round(allocs.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  return `${fmt(total)} split ${allocs.length} ways`;
}

function renderTransactionRow(t, pool) {
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
    bucketLabel = `<button class="txn-bucket txn-bucket-btn" onclick="openAssignBucket('${t.id}')" title="Move to another bucket"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bucket.color};margin-right:4px;vertical-align:middle"></span>${escHtml(bucket.name)}</button>`;
  } else if (t.bucketId && !bucket) {
    bucketLabel = `<span class="txn-bucket deleted">Deleted bucket <button class="btn-assign" onclick="openAssignBucket('${t.id}')">Assign</button></span>`;
  } else {
    bucketLabel = `<span class="txn-bucket uncategorized">Uncategorized <button class="btn-assign" onclick="openAssignBucket('${t.id}')">Assign</button></span>`;
  }

  const incomeBadge = hasIncomeTag(t)
    ? `<span class="txn-tag txn-tag-income" title="Marked as income">${icons.piggyBank} ${findIncomeTargetLabel(t)}</span>`
    : '';
  const transferBadge = t.transferInAllocation
    ? `<span class="txn-tag txn-tag-transfer" title="Marked as transfer-in">${icons.arrowsUpDown} Transferred</span>`
    : '';

  const dateStr = fmtTxnDate(t.date);
  const isGoalSavings = pool.type === 'goal-savings';

  const actions = [
    `<button class="swipe-action-btn swipe-action-income" data-action="income" data-txn-id="${t.id}" data-pool-id="${pool.id}">${icons.piggyBank}<span>Income</span></button>`,
    isGoalSavings && !t.transferInAllocation ? `<button class="swipe-action-btn swipe-action-transfer" data-action="transfer-in" data-txn-id="${t.id}" data-pool-id="${pool.id}">${icons.arrowsUpDown}<span>Transfer In</span></button>` : '',
    isGoalSavings && t.transferInAllocation ? `<button class="swipe-action-btn swipe-action-transfer" data-action="transfer-in-undo" data-txn-id="${t.id}" data-pool-id="${pool.id}">${icons.undo}<span>Undo</span></button>` : '',
    `<button class="swipe-action-btn swipe-action-delete" data-action="txn-delete" data-txn-id="${t.id}">${icons.trash}<span>Delete</span></button>`,
  ].filter(Boolean).join('');

  return `
    <div class="swipe-container txn-swipe" data-id="${t.id}">
      <div class="swipe-actions swipe-actions-right">${actions}</div>
      <div class="swipe-content txn-swipe-content">
        <div class="txn-row ${!t.bucketId && !isDeposit ? 'txn-uncategorized' : ''}">
          <div class="txn-info">
            <span class="txn-vendor">${plaidBadge}${escHtml(t.vendor)}</span>
            ${t.note ? `<span class="txn-note">${escHtml(t.note)}</span>` : ''}
            ${incomeBadge || transferBadge ? `<span class="txn-tags">${incomeBadge}${transferBadge}</span>` : ''}
          </div>
          <div class="txn-meta">
            ${bucketLabel}
            <span class="txn-date">${dateStr}</span>
          </div>
          <div class="txn-amount" ${isDeposit ? 'style="color:var(--color-success)"' : ''}>
            ${isDeposit ? '+' : '-'}${fmt(t.amount)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function hasIncomeTag(t) {
  return (Array.isArray(t.incomeAllocations) && t.incomeAllocations.length > 0) || !!t.incomeAllocation;
}

function isIncomeTxn(t) {
  return t.type === 'deposit'
    || !!t.incomeAllocation
    || (Array.isArray(t.incomeAllocations) && t.incomeAllocations.length > 0)
    || !!t.transferInAllocation;
}

function setTxnFilter(filter) {
  txnFilter = filter;
  txnListExpanded = false;
  renderTransactionHistory();
}

function renderTxnFilterTabs(outgoingCount, incomeCount) {
  return `
    <div class="txn-filter-tabs" role="tablist">
      <button class="txn-filter-tab ${txnFilter === 'outgoing' ? 'active' : ''}" role="tab" onclick="setTxnFilter('outgoing')">
        Outgoing <span class="txn-filter-count">${outgoingCount}</span>
      </button>
      <button class="txn-filter-tab ${txnFilter === 'income' ? 'active' : ''}" role="tab" onclick="setTxnFilter('income')">
        Income <span class="txn-filter-count">${incomeCount}</span>
      </button>
    </div>
  `;
}

function renderTransactionHistory() {
  const pool = activePool();
  const listEl = document.getElementById('transaction-list');
  const emptyEl = document.getElementById('transactions-empty');
  const allTxns = (pool.transactions || [])
    .slice()
    .sort(compareTxnsNewestFirst);

  if (allTxns.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const incomeTxns = allTxns.filter(isIncomeTxn);
  const outgoingTxns = allTxns.filter(t => !isIncomeTxn(t));
  const tabs = renderTxnFilterTabs(outgoingTxns.length, incomeTxns.length);

  const activeTxns = txnFilter === 'income' ? incomeTxns : outgoingTxns;

  if (activeTxns.length === 0) {
    listEl.innerHTML = tabs + `<p class="empty-hint" style="padding:1.25rem 0">No ${txnFilter} transactions yet.</p>`;
    return;
  }

  const displayed = txnListExpanded ? activeTxns : activeTxns.slice(0, 20);
  const rows = displayed.map(t => renderTransactionRow(t, pool)).join('');
  let showMore = '';
  if (activeTxns.length > 20) {
    showMore = txnListExpanded
      ? `<button class="btn-small txn-show-more" onclick="toggleTxnListExpanded()">Show less</button>`
      : `<button class="btn-small txn-show-more" onclick="toggleTxnListExpanded()">Show all (${activeTxns.length})</button>`;
  }

  listEl.innerHTML = tabs + rows + showMore;
}

function toggleTxnListExpanded() {
  txnListExpanded = !txnListExpanded;
  renderTransactionHistory();
}

function openBucketTransactions(bucketId) {
  const pool = activePool();
  const bucket = pool.buckets.find(b => b.id === bucketId);
  if (!bucket) return;

  // Savings deposits count toward every bucket they were allocated to
  const allocationsHere = t => (t.allocations || []).filter(a => a.bucketId === bucketId);
  const txns = (pool.transactions || [])
    .filter(t => t.bucketId === bucketId || (t.type === 'deposit' && allocationsHere(t).length > 0))
    .sort(compareTxnsNewestFirst);

  const rows = txns.map(t => {
    const plaidBadge = t.source === 'plaid' ? `<span class="txn-plaid-badge">${icons.link}</span>` : '';
    const amount = t.type === 'deposit'
      ? `<span class="txn-amount" style="color:var(--color-success)">+${fmt(allocationsHere(t).reduce((s, a) => s + a.amount, 0))}</span>`
      : `<span class="txn-amount">-${fmt(t.amount)}</span>`;
    return `
      <div class="rule-row">
        <span class="txn-vendor" style="flex:1">${plaidBadge}${escHtml(t.vendor)}</span>
        ${amount}
        <span class="txn-date">${fmtTxnDate(t.date)}</span>
        <button class="btn-icon" onclick="deleteTransaction('${t.id}')" title="Delete">${icons.x}</button>
      </div>
    `;
  }).join('');

  openModal(`${bucket.name} — Transactions`, `
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

  const effects = [];
  if (txn.type === 'deposit') {
    const allocated = (txn.allocations || []).length > 0;
    effects.push(`${fmt(txn.amount)} will be removed from the balance${allocated ? ' and from the buckets it was allocated to' : ''}.`);
  } else {
    const hasBucket = pool.buckets.some(b => b.id === txn.bucketId);
    effects.push(`${fmt(txn.amount)} will be refunded to ${hasBucket ? 'the bucket and ' : ''}balance.`);
  }
  if (hasIncomeTag(txn)) effects.push('Its income tagging will be reversed (tax bucket targets go back down).');
  if (txn.transferInAllocation) effects.push('The amounts it filled will be removed from the tax buckets.');

  openModal('Delete Transaction', `
    <p style="margin-bottom:0.5rem">Delete <strong>${fmt(txn.amount)}</strong> at <strong>${escHtml(txn.vendor)}</strong>?</p>
    <p class="modal-subtitle" style="margin-bottom:0.5rem">${effects.join(' ')}</p>
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
    showToast('Transaction deleted');
  } catch (err) {
    showError(err);
  }
}

// --- Assign Uncategorized Transaction ---

function openAssignBucket(txnId) {
  const pool = activePool();
  const txn = (pool.transactions || []).find(t => t.id === txnId);
  if (!txn || txn.type === 'deposit') return;

  if (pool.buckets.length === 0) {
    showToast('Create a bucket first', true);
    return;
  }

  // Already in a bucket that still exists → this is a move
  const isMove = pool.buckets.some(b => b.id === txn.bucketId);
  const isSavings = pool.type === 'savings';
  const bucketOptions = pool.buckets.map(b => {
    const label = isSavings
      ? `${escHtml(b.name)} (${b.percentage}%)`
      : `${escHtml(b.name)} (${fmt(b.allocatedAmount)} available)`;
    return `<option value="${b.id}" ${b.id === txn.bucketId ? 'selected' : ''}>${label}</option>`;
  }).join('');

  openModal(isMove ? 'Move to Bucket' : 'Assign to Bucket', `
    <p style="margin-bottom:1rem">
      <strong>${escHtml(txn.vendor)}</strong> &mdash; <span class="txn-amount">-${fmt(txn.amount)}</span>
    </p>
    <div class="form-group">
      <label for="assign-bucket">Bucket</label>
      <select id="assign-bucket">${bucketOptions}</select>
    </div>
    <label class="form-check">
      <input type="checkbox" id="assign-create-rule">
      <span>Also create auto-assign rule for "${escHtml(txn.vendor)}"</span>
    </label>
    <div class="form-error" id="assign-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitAssignBucket('${txnId}')">${isMove ? 'Move' : 'Assign'}</button>
    </div>
  `);
}

async function submitAssignBucket(txnId) {
  const pool = activePool();
  const bucketId = document.getElementById('assign-bucket').value;
  const createRule = document.getElementById('assign-create-rule').checked;
  const txn = (pool.transactions || []).find(t => t.id === txnId);
  const wasInBucket = !!txn && pool.buckets.some(b => b.id === txn.bucketId);
  const unchanged = !!txn && txn.bucketId === bucketId;

  if (unchanged && !createRule) {
    closeModal();
    return;
  }

  try {
    if (!unchanged) state = await poolApi('PUT', `/transactions/${txnId}/assign`, { bucketId });
  } catch (err) {
    showError(err, 'assign-error');
    return;
  }

  let appliedCount = 0;
  let ruleErr = null;
  if (createRule && txn) {
    try {
      const result = await poolApi('POST', '/auto-assign-rules', {
        pattern: txn.vendor.toLowerCase(),
        bucketId,
        applyToExisting: true,
      });
      appliedCount = result.appliedCount || 0;
      delete result.appliedCount;
      state = result;
    } catch (err) {
      ruleErr = err;
    }
  }

  if (ruleErr && (ruleErr.authRequired || unchanged)) {
    // Nothing else changed — keep the modal open with the error
    showError(ruleErr, 'assign-error');
    return;
  }

  closeModal();
  render();
  if (unchanged) {
    showToast(ruleAddedMessage(appliedCount));
  } else {
    const bucket = pool.buckets.find(b => b.id === bucketId);
    const extra = appliedCount > 0 ? ` — rule assigned ${appliedCount} more` : '';
    showToast(`${wasInBucket ? 'Moved to' : 'Assigned to'} ${bucket ? bucket.name : 'bucket'}${extra}`);
  }
  if (ruleErr) showToast(`Rule not created: ${ruleErr.message}`, true);
}

// --- Income Tagging / Transfer-In ---

function getGoalSavingsBuckets() {
  return state.pools
    .flatMap(p => p.buckets.map(b => ({ pool: p, bucket: b })))
    .filter(({ bucket }) => bucket.isTax);
}

let splitState = null;

function openMarkIncomeModal(poolId, txnId) {
  const pool = state.pools.find(p => p.id === poolId);
  const txn = pool?.transactions.find(t => t.id === txnId);
  if (!pool || !txn) return;

  const options = getGoalSavingsBuckets();
  if (options.length === 0) {
    openModal('Mark as Income', `
      <p style="color:var(--text-secondary);font-size:0.9rem">You need at least one <strong>tax bucket</strong> first. Open any bucket's edit screen (or create a new one) and choose the Tax kind.</p>
      <div class="form-actions">
        <button class="btn-primary" onclick="closeModal()">OK</button>
      </div>
    `);
    return;
  }

  const total = Math.round(txn.amount * 100) / 100;
  const existingAllocs = Array.isArray(txn.incomeAllocations) && txn.incomeAllocations.length > 0
    ? txn.incomeAllocations
    : (txn.incomeAllocation ? [txn.incomeAllocation] : []);

  if (existingAllocs.length > 0) {
    let pos = 0;
    const dots = [0];
    const assignments = [];
    for (const a of existingAllocs) {
      pos = Math.round((pos + a.amount) * 100) / 100;
      dots.push(pos);
      assignments.push(`${a.targetPoolId}:${a.targetBucketId}`);
    }
    if (pos < total - 0.005) {
      dots.push(total);
      assignments.push(null);
    }
    splitState = { total, dots, assignments };
  } else {
    const defaultAmount = Math.round(total * 0.25 * 100) / 100;
    splitState = {
      total,
      dots: [0, defaultAmount, total],
      assignments: [`${options[0].pool.id}:${options[0].bucket.id}`, null],
    };
  }

  openModal('Mark as Income', `
    <p style="color:var(--text-secondary);font-size:0.85rem;margin:0 0 0.6rem 0">
      <strong>${escHtml(txn.vendor)}</strong> · ${fmt(txn.amount)}
    </p>
    <div class="split-quick-fill">
      <span class="split-quick-fill-label">Quick fill:</span>
      <button type="button" class="split-quick-btn" onclick="quickFillSplit(0.20)">20%</button>
      <button type="button" class="split-quick-btn" onclick="quickFillSplit(0.25)">25%</button>
      <button type="button" class="split-quick-btn" onclick="quickFillSplit(0.30)">30%</button>
      <button type="button" class="split-quick-btn" onclick="quickFillSplit(1.0)">All</button>
      <button type="button" class="split-quick-btn split-quick-clear" onclick="quickFillSplit(0)">Clear</button>
    </div>
    <div class="split-bar-hint">Tap the line to add a split · drag dots to adjust</div>
    <div id="split-bar-container"></div>
    <div id="split-segments"></div>
    <div class="form-error" id="income-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitMarkIncomeSplit('${poolId}', '${txnId}')">Save</button>
    </div>
  `);

  renderSplitBar();
  renderSplitSegments();
  wireSplitBar();
}

function renderSplitBar() {
  const el = document.getElementById('split-bar-container');
  if (!el || !splitState) return;
  const { total, dots, assignments } = splitState;

  const segmentHtml = [];
  for (let i = 0; i < dots.length - 1; i++) {
    const from = dots[i];
    const to = dots[i + 1];
    const leftPct = (from / total) * 100;
    const widthPct = ((to - from) / total) * 100;
    const isAssigned = !!assignments[i];
    segmentHtml.push(`<div class="split-seg ${isAssigned ? 'assigned' : 'unassigned'}" data-seg-index="${i}" style="left:${leftPct}%;width:${widthPct}%"></div>`);
  }

  const dotHtml = dots.map((pos, i) => {
    const isFixed = (i === 0 || i === dots.length - 1);
    const leftPct = total > 0 ? (pos / total) * 100 : 0;
    const pctLabel = total > 0 ? `${Math.round(leftPct)}%` : '0%';
    return `<div class="split-dot ${isFixed ? 'fixed' : 'draggable'}" data-dot-index="${i}" style="left:${leftPct}%">
      <span class="split-dot-value">${fmt(pos)}<span class="split-dot-pct">${pctLabel}</span></span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="split-bar" id="split-bar-track">
      <div class="split-bar-line"></div>
      ${segmentHtml.join('')}
      ${dotHtml}
    </div>
  `;
}

function renderSplitSegments() {
  const el = document.getElementById('split-segments');
  if (!el || !splitState) return;
  const { dots, assignments } = splitState;
  const options = getGoalSavingsBuckets();

  const total = splitState.total;
  const rows = [];
  for (let i = 0; i < dots.length - 1; i++) {
    const amount = Math.round((dots[i + 1] - dots[i]) * 100) / 100;
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    const selectedKey = assignments[i] || '';
    const bucketOptions = [
      `<option value="" ${!selectedKey ? 'selected' : ''}>— Unassigned —</option>`,
      ...options.map(({ pool, bucket }) => {
        const key = `${pool.id}:${bucket.id}`;
        return `<option value="${key}" ${key === selectedKey ? 'selected' : ''}>${escHtml(pool.name)} › ${escHtml(bucket.name)}</option>`;
      }),
    ].join('');

    const canRemove = i > 0 && dots.length > 2;
    rows.push(`
      <div class="split-segment-row ${selectedKey ? 'assigned' : 'unassigned'}">
        <div class="split-segment-dot"></div>
        <div class="split-segment-amount">${fmt(amount)}<span class="split-segment-pct">${pct}%</span></div>
        <select class="split-segment-bucket" onchange="updateSegmentBucket(${i}, this.value)">${bucketOptions}</select>
        ${canRemove ? `<button class="split-remove" onclick="removeDot(${i})" title="Remove this split">×</button>` : '<span class="split-remove-spacer"></span>'}
      </div>
    `);
  }
  el.innerHTML = rows.join('');
}

const _splitDrag = { index: null };

function _splitPosFromClientX(clientX) {
  const track = document.getElementById('split-bar-track');
  if (!track || !splitState) return 0;
  const rect = track.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  return Math.round((splitState.total * (x / rect.width)) * 100) / 100;
}

function _splitOnMove(clientX) {
  if (_splitDrag.index === null || !splitState) return;
  const dots = splitState.dots;
  const idx = _splitDrag.index;
  let pos = _splitPosFromClientX(clientX);
  const leftMin = dots[idx - 1] + 0.01;
  const rightMax = dots[idx + 1] - 0.01;
  pos = Math.max(leftMin, Math.min(rightMax, pos));
  dots[idx] = pos;
  renderSplitBar();
  renderSplitSegments();
  wireSplitBar();
}

function _splitEndDrag() { _splitDrag.index = null; }

if (!window._splitGlobalWired) {
  window._splitGlobalWired = true;
  document.addEventListener('mousemove', (e) => _splitOnMove(e.clientX));
  document.addEventListener('touchmove', (e) => {
    if (_splitDrag.index === null) return;
    _splitOnMove(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('mouseup', _splitEndDrag);
  document.addEventListener('touchend', _splitEndDrag);
}

function wireSplitBar() {
  const track = document.getElementById('split-bar-track');
  if (!track) return;

  track.onclick = (e) => {
    if (e.target.closest('.split-dot')) return;
    const pos = _splitPosFromClientX(e.clientX);
    addDot(pos);
  };

  track.querySelectorAll('.split-dot.draggable').forEach(dot => {
    const idx = parseInt(dot.dataset.dotIndex, 10);
    dot.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); _splitDrag.index = idx; };
    dot.ontouchstart = (e) => { e.stopPropagation(); _splitDrag.index = idx; };
  });
}

function addDot(pos) {
  if (!splitState) return;
  const { dots, assignments } = splitState;
  if (pos <= dots[0] + 0.02 || pos >= dots[dots.length - 1] - 0.02) return;
  let insertIdx = 1;
  for (let i = 0; i < dots.length - 1; i++) {
    if (pos > dots[i] && pos < dots[i + 1]) { insertIdx = i + 1; break; }
  }
  dots.splice(insertIdx, 0, pos);
  assignments.splice(insertIdx, 0, null);
  renderSplitBar();
  renderSplitSegments();
  wireSplitBar();
}

function removeDot(idx) {
  if (!splitState) return;
  const { dots, assignments } = splitState;
  if (idx <= 0 || idx >= dots.length - 1) return;
  dots.splice(idx, 1);
  assignments.splice(idx, 1);
  renderSplitBar();
  renderSplitSegments();
  wireSplitBar();
}

function updateSegmentBucket(segIdx, value) {
  if (!splitState) return;
  splitState.assignments[segIdx] = value || null;
  renderSplitBar();
}

function quickFillSplit(fraction) {
  if (!splitState) return;
  const total = splitState.total;
  const options = getGoalSavingsBuckets();
  // Preserve the first segment's current assignment if present, else use first tax bucket
  const existingFirstAssign = splitState.assignments[0];
  const defaultAssign = options.length > 0
    ? `${options[0].pool.id}:${options[0].bucket.id}`
    : null;
  const firstAssign = existingFirstAssign || defaultAssign;

  if (fraction <= 0) {
    // Clear: one full-width segment, unassigned
    splitState.dots = [0, total];
    splitState.assignments = [null];
  } else if (fraction >= 1) {
    // Entire amount assigned to the first tax bucket
    splitState.dots = [0, total];
    splitState.assignments = [firstAssign];
  } else {
    const cut = Math.round(total * fraction * 100) / 100;
    splitState.dots = [0, cut, total];
    splitState.assignments = [firstAssign, null];
  }
  renderSplitBar();
  renderSplitSegments();
  wireSplitBar();
}

async function submitMarkIncomeSplit(poolId, txnId) {
  if (!splitState) return;
  const { dots, assignments } = splitState;
  const splits = [];
  for (let i = 0; i < dots.length - 1; i++) {
    const amount = Math.round((dots[i + 1] - dots[i]) * 100) / 100;
    if (amount <= 0) continue;
    const assign = assignments[i];
    if (!assign) continue;
    const [targetPoolId, targetBucketId] = assign.split(':');
    splits.push({ targetPoolId, targetBucketId, amount });
  }

  try {
    state = await api('POST', `/api/pools/${poolId}/transactions/${txnId}/mark-income-split`, { splits });
    closeModal();
    render();
    const totalAssigned = splits.reduce((s, x) => s + x.amount, 0);
    showToast(splits.length > 0
      ? `Income: ${fmt(totalAssigned)} across ${splits.length} bucket${splits.length === 1 ? '' : 's'}`
      : 'Income tag cleared');
  } catch (err) {
    showError(err, 'income-error');
  }
}

async function markTransferIn(poolId, txnId) {
  const pool = state.pools.find(p => p.id === poolId);
  const txn = pool?.transactions.find(t => t.id === txnId);
  if (!pool || !txn) return;

  if (!confirm(`Apply ${fmt(txn.amount)} to ${pool.name} tax goals?`)) return;

  try {
    const result = await api('POST', `/api/pools/${poolId}/transactions/${txnId}/mark-transfer-in`, {});
    const summary = result.transferInSummary;
    delete result.transferInSummary;
    state = result;
    render();
    if (summary) {
      const fillText = summary.fills.length
        ? summary.fills.map(f => `${fmt(f.amount)} → ${f.bucketName}`).join(', ')
        : 'no bucket needed filling';
      const unallocText = summary.unallocated > 0 ? ` · ${fmt(summary.unallocated)} unallocated` : '';
      showToast(`Filled: ${fillText}${unallocText}`);
    } else {
      showToast('Transfer applied');
    }
  } catch (err) {
    showError(err);
  }
}

async function undoTransferIn(poolId, txnId) {
  const pool = state.pools.find(p => p.id === poolId);
  const txn = pool?.transactions.find(t => t.id === txnId);
  if (!pool || !txn?.transferInAllocation) return;

  if (!confirm(`Undo the transfer-in for ${txn.vendor}? The amounts it filled will be removed from the tax buckets.`)) return;

  try {
    state = await api('DELETE', `/api/pools/${poolId}/transactions/${txnId}/transfer-in`);
    render();
    showToast('Transfer-in undone');
  } catch (err) {
    showError(err);
  }
}

// --- Auto-Assign Rules ---

function openManageRules() {
  if (!requireActivePool()) return;
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
      <div class="hint">Case-insensitive. Matches if vendor name contains this text; the longest matching pattern wins.</div>
    </div>
    <div class="form-group">
      <label for="rule-bucket">Assign to Bucket</label>
      <select id="rule-bucket">${bucketOptions}</select>
    </div>
    <label class="form-check">
      <input type="checkbox" id="rule-apply-existing" checked>
      <span>Also apply to existing uncategorized transactions</span>
    </label>
    <div class="form-error" id="rule-error"></div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-primary" onclick="submitRule()">Add Rule</button>
    </div>
  `);
}

function ruleAddedMessage(appliedCount) {
  return appliedCount > 0
    ? `Rule added — ${appliedCount} transaction${appliedCount === 1 ? '' : 's'} assigned`
    : 'Rule added';
}

async function submitRule() {
  const pattern = document.getElementById('rule-pattern').value.trim();
  const bucketId = document.getElementById('rule-bucket').value;
  const applyToExisting = document.getElementById('rule-apply-existing').checked;

  if (!pattern) {
    document.getElementById('rule-error').textContent = 'Pattern is required';
    return;
  }
  if (!bucketId) {
    document.getElementById('rule-error').textContent = 'Create a bucket first';
    return;
  }

  try {
    const result = await poolApi('POST', '/auto-assign-rules', { pattern, bucketId, applyToExisting });
    const appliedCount = result.appliedCount || 0;
    delete result.appliedCount;
    state = result;
    render();
    showToast(ruleAddedMessage(appliedCount));
    openManageRules();
  } catch (err) {
    showError(err, 'rule-error');
  }
}

async function deleteRule(id) {
  try {
    state = await poolApi('DELETE', `/auto-assign-rules/${id}`);
    render();
    showToast('Rule deleted');
    openManageRules();
  } catch (err) {
    showError(err);
  }
}

// --- Event Listeners ---

document.getElementById('edit-balance-btn').addEventListener('click', openEditBalance);
document.getElementById('new-bucket-btn').addEventListener('click', openNewBucket);
document.getElementById('transfer-btn').addEventListener('click', openTransfer);
document.getElementById('log-purchase-btn').addEventListener('click', () => openLogPurchase(null));
document.getElementById('log-deposit-btn').addEventListener('click', openLogDeposit);
document.getElementById('manage-rules-btn').addEventListener('click', openManageRules);
document.getElementById('lock-btn').addEventListener('click', lockApp);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { SwipeController.closeAll(); closeModal(); }
  if (e.key !== 'Enter' || e.repeat || e.isComposing) return;
  if (document.getElementById('modal-overlay').classList.contains('hidden')) return;
  // Enter on a focused button/link/select/textarea keeps its native meaning
  if (['BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const primaryBtn = document.querySelector('#modal-body .btn-primary');
  if (primaryBtn && !primaryBtn.disabled) primaryBtn.click();
});

// --- Lock Screen (only when the server has APP_PASSWORD set) ---

function updateLockButton() {
  document.getElementById('lock-btn').classList.toggle('hidden', !authEnabled);
}

function showLogin() {
  authEnabled = true;
  updateLockButton();
  if (authLocked) return;
  SwipeController.closeAll();
  openModal('Unlock Bucket Budget', `
    <div class="form-group">
      <label for="login-password">Password</label>
      <input type="password" id="login-password" autocomplete="current-password">
    </div>
    <div class="form-error" id="login-error"></div>
    <div class="form-actions">
      <button class="btn-primary" onclick="submitLogin()">Unlock</button>
    </div>
  `);
  authLocked = true;
  document.getElementById('modal-overlay').classList.add('locked');
  document.getElementById('login-password').focus();
}

async function submitLogin() {
  const input = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  if (!input.value) {
    errorEl.textContent = 'Enter your password';
    return;
  }

  try {
    await api('POST', '/api/login', { password: input.value });
  } catch (err) {
    errorEl.textContent = err.message;
    input.focus();
    input.select();
    return;
  }

  authLocked = false;
  document.getElementById('modal-overlay').classList.remove('locked');
  closeModal();
  fetchState();
  fetchPlaidStatus();
}

async function lockApp() {
  try {
    await api('POST', '/api/logout');
  } catch (err) {
    // Without a successful logout the session cookie is still valid, so don't pretend to lock
    if (!err.authRequired) { showError(err); return; }
  }
  state = { pools: [], activePoolId: null };
  plaidStatus = { configured: false, linked: false, items: [], accounts: [], sandbox: false };
  txnListExpanded = false;
  closeModal();
  render();
  showLogin();
}

async function initApp() {
  try {
    const session = await api('GET', '/api/session');
    authEnabled = !!session.authRequired;
    updateLockButton();
    if (session.authRequired && !session.authenticated) {
      showLogin();
      return;
    }
  } catch (err) {
    // Servers without /api/session have no lock — carry on
  }
  // Set by plaid-oauth-return.html after linking a bank via an OAuth redirect
  if (localStorage.getItem('plaid_just_linked')) {
    localStorage.removeItem('plaid_just_linked');
    afterAccountLinked();
    return;
  }
  fetchState();
  fetchPlaidStatus();
}

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
initApp();
showInstallHint();
SwipeController.init();
document.getElementById('manage-rules-btn').innerHTML = icons.rules + ' Auto-Assign Rules';
document.getElementById('lock-btn').innerHTML = icons.lock + ' Lock';
