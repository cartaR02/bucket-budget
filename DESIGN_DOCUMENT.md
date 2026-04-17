# Bucket Budget — UI Design Document
*For use with Google Stitch / design tools*

---

## 1. App Overview

**Name:** Bucket Budget  
**Type:** Personal finance PWA (Progressive Web App) — mobile-first, installable  
**Concept:** Envelope budgeting visualized as literal liquid-filled buckets. Money is organized into named "buckets" (categories) within "pools" (account groups).  
**Backend:** Node.js + Express, optional Plaid bank integration  
**Users:** Personal finance users managing a single set of accounts  

### Core Mental Model
- A **Pool** = one bank account or budget context (e.g. "Checking", "Savings")
- A **Bucket** = a spending category with a dollar goal (e.g. "Rent $1200", "Groceries $400")
- Spending drains a bucket. Deposits fill it.
- **Spending pools** use dollar-based buckets. **Savings pools** use percentage-split buckets.

---

## 2. Current Design System

### Color Palette — "Warm Atelier"

| Token | Hex | Usage |
|---|---|---|
| `--primary-from` | `#B55A30` | Burnt copper — primary CTAs, accents, active state |
| `--primary-to` | `#9A4A25` | Darker copper — gradient end |
| `--bg-body` | `#F8F6F1` | Aged paper warm white — page background |
| `--bg-card` | `#FFFFFF` | Card surface |
| `--bg-input` | `#F3F1EC` | Warm off-white — input fields |
| `--text-primary` | `#1A1614` | Near-black warm ink |
| `--text-secondary` | `#78716C` | Warm gray |
| `--text-tertiary` | `#A8A29E` | Muted warm gray — labels, hints |
| `--color-success` | `#16A34A` | Green — deposits, connected status |
| `--color-danger` | `#DC2626` | Red — overspent, uncategorized, delete |

### Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / headings | Lora (serif) | 400, 500, 600 | Section titles, balance amounts, bucket %, modal titles |
| Body / UI | Outfit (sans-serif) | 300, 400, 500, 600, 700 | All labels, buttons, form text, transaction list |

### Spacing & Radii

| Token | Value | Usage |
|---|---|---|
| Card radius | `12px` | Bucket cards, balance card |
| Modal radius | `16px` | Modal dialogs |
| Button radius | `24px` (pill) | All buttons |
| Input radius | `8px` | Form inputs |
| Max content width | `960px` | Center-aligned layout |
| Body padding | `1.75rem 1rem` | Main page padding |

### Shadow System

| Context | Style |
|---|---|
| Card rest | `0 1px 3px rgba(120,100,80,0.06), 0 4px 20px rgba(120,100,80,0.04)` |
| Card hover | `0 8px 30px rgba(120,100,80,0.1)` + copper ring |
| Modal | `0 24px 64px rgba(26,22,20,0.18)` |
| Button rest | `0 1px 4px rgba(181,90,48,0.2)` |
| Button hover | `0 4px 16px rgba(181,90,48,0.28)` |

---

## 3. Page Layout — Current Structure

```
┌─────────────────────────────────────────────────┐
│  HEADER (sticky, blur backdrop)                 │
│  [~] Bucket Budget                              │
├─────────────────────────────────────────────────┤
│  POOL TABS (horizontal scroll, underline style) │
│  [My Budget] [Savings %] [+]                    │
├─────────────────────────────────────────────────┤
│  BALANCE CARD                                   │
│  Total Balance  $3,200.00  [Edit]               │
│  Allocated      $2,800.00                       │
│  Unallocated    $400.00                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  (progress bar)     │
│  [Bank Connected ●] [Sync] [Disconnect]         │
├─────────────────────────────────────────────────┤
│  BUCKETS SECTION                                │
│  Buckets    [Log Deposit] [Log Purchase]        │
│             [Transfer] [+ New Bucket]           │
│  ┌───────┐ ┌───────┐ ┌───────┐                 │
│  │Rent   │ │Grocer │ │Car    │                  │
│  │~~~~~~~│ │~~~~~~~│ │~~~~~~~│  (liquid fill)  │
│  │ $800  │ │ $240  │ │ $150  │                  │
│  │of$1200│ │of$400 │ │of$300 │                  │
│  └───────┘ └───────┘ └───────┘                 │
├─────────────────────────────────────────────────┤
│  TRANSACTIONS SECTION                           │
│  Recent Transactions   [Auto-Assign Rules]      │
│  Starbucks  Groceries  $6.50   Apr 10           │
│  Amazon     Shopping   $24.99  Apr 9            │
│  [Show more]                                    │
└─────────────────────────────────────────────────┘
```

---

## 4. Components — Detailed Specs

### 4.1 Header

**Height:** ~56px  
**Background:** `rgba(255,255,255,0.88)` + `backdrop-filter: blur(20px)`  
**Border bottom:** `1px solid rgba(0,0,0,0.06)`  
**Position:** Sticky top  

**Contents:**
- Left: Droplet SVG icon (copper color `#B55A30`) + "Bucket Budget" in Lora 600 1.3rem
- Right: *(currently empty — opportunity for nav/settings)*

**Issues to address in redesign:**
- No user settings accessible from header
- No global search
- No profile/account area
- On mobile, the header feels sparse with unused right side

---

### 4.2 Pool Tabs

**Style:** Underline tabs (no background/pills)  
**Active:** Copper bottom border `2px`, copper text, weight 600  
**Inactive:** Tertiary text, transparent  
**Badge:** Small copper-tinted badge `[%]` on savings pools  
**Add button:** `[+]` icon, same underline tab style  

**Data:**
```
Pool {
  id: string
  name: string         // max 30 chars
  type: 'spending' | 'savings'
  balance: number
  buckets: Bucket[]
  transactions: Transaction[]
  autoAssignRules: Rule[]
  linkedAccountIds: string[]
}
```

---

### 4.3 Balance Card

**Background:** White card  
**Padding:** `1.75rem 2rem`  
**Border radius:** `12px`  

**Three columns:**

| Column | Label | Amount Style |
|---|---|---|
| Total Balance | "TOTAL BALANCE" (uppercase, 0.68rem, tertiary) | Lora 2.2rem, primary color, thin weight |
| Allocated | "ALLOCATED" | Lora 1.5rem, secondary color |
| Unallocated | "UNALLOCATED" | Lora 1.5rem, copper accent (or red if negative) |

**Edit button:** Small copper pill button beside Total Balance  

**Summary Bar (below amounts):**
- 5px tall, rounded, `rgba(0,0,0,0.04)` background
- Filled segments in each bucket's color, proportional width
- Animated width transitions (0.5s)

**Plaid Section (conditional):**
- Shown when bank linked or when prompting to link
- Green pulsing dot = connected
- Contains: bank name, account list (collapsible), sync button, disconnect option

---

### 4.4 Bucket Card

**Grid:** `repeat(auto-fill, minmax(280px, 1fr))`  
**Animation:** Staggered fade-in-up on load (60ms delay between cards)  

**Card structure:**
```
┌──────────────────────────────┐
│  [·] Rent        [···]       │  ← name row + ellipsis trigger
│  $800 of $1,200              │  ← amounts (Lora for $800)
│                              │
│         ┌────────┐           │  ← bucket handle (arch)
│    ┌────┤  RIM   ├────┐      │  ← rim bar
│    │    ▓▓▓▓▓▓    │   │      │  ← liquid fill (animated)
│    │  ≋≋≋≋≋≋≋≋≋   │   │      │  ← wave animation
│    │    66%        │   │      │  ← percentage label (centered)
│    └───────────────┘   │      │
│                              │
│  3 transactions              │  ← clickable to filter
└──────────────────────────────┘
```

**Bucket fill states:**

| State | Fill % | Visual |
|---|---|---|
| Empty | 0% | Just the empty ceramic vessel |
| Partial | 1–99% | Colored liquid with wave animation |
| Full | 100% | Green-tinted border + soft glow |
| Over budget | >100% | Red-tinted border + red glow |

**Fill color:** Each bucket has one of 8 colors assigned on creation:
`#4F46E5` (indigo), `#10B981` (emerald), `#F59E0B` (amber), `#EF4444` (red), `#8B5CF6` (violet), `#EC4899` (pink), `#06B6D4` (cyan), `#F97316` (orange)

**Swipe actions (mobile / drag):**

- Swipe LEFT → reveals right-side actions: Delete (red bg)
- Swipe RIGHT → reveals left-side actions: Spend, Edit, Add/Remove Funds (copper bg)
- Desktop hover: shows `···` trigger button in top-right

**Swipe action buttons:**

| Button | Icon | Action |
|---|---|---|
| Spend | receipt icon | Opens Log Purchase modal pre-filled with bucket |
| Edit | pencil icon | Opens Edit Bucket modal |
| Funds | arrows-up-down | Opens Add/Remove Funds modal |
| Delete | trash icon | Opens Delete Bucket confirmation |

**Savings bucket differences:**
- No "Spend" action
- Shows percentage allocation instead of dollar goal
- `accumulatedAmount` tracked separately from pool balance

---

### 4.5 Modals

**Overlay:** `rgba(26,22,20,0.45)` + `backdrop-filter: blur(8px)`  
**Modal card:** White, `max-width: 460px`, `border-radius: 16px`  
**Animation:** Scale from 0.97 + translateY(6px), 250ms spring curve  

**Header:** `1.25rem Lora` title + `×` close button  
**Body padding:** `1.75rem`  

**Form inputs:**
- Background: `#F3F1EC` (warm off-white)
- Border: `1px solid rgba(0,0,0,0.12)`
- Focus: Copper border `rgba(181,90,48,0.4)` + 3px copper glow ring
- Label: Uppercase, 0.68rem, tertiary color, letter-spacing 0.08em

**Modal types in current app:**

| Modal | Purpose | Fields |
|---|---|---|
| New Bucket | Create bucket | Name, Goal Amount, Color picker (8 swatches) |
| Edit Bucket | Modify bucket | Name, Goal Amount, Color picker |
| Log Purchase | Record spending | Amount, Vendor name, Note (optional), Bucket selector |
| Log Deposit | Record income | Amount, Note (optional), Pool selector |
| Transfer | Move between buckets | Amount, From bucket, To bucket |
| Add/Remove Funds | Adjust bucket balance | Amount, +/- toggle, Note |
| New Pool | Create pool | Name, Type (spending/savings) |
| Edit Pool | Rename pool | Name |
| Auto-Assign Rules | Manage rules | Pattern → Bucket mapping list + add form |
| Delete Bucket | Confirm deletion | Warning text + confirm/cancel |
| Edit Balance | Manual balance entry | Dollar amount input |
| Sync Summary | Post-sync results | Stats: new transactions, new uncat., updated |

---

### 4.6 Transaction List

**Layout:** Vertical list, each row as card-like row  

**Row structure:**
```
[Plaid badge?]  Starbucks              -$6.50
                Groceries · Apr 10    [×]
```

**Columns:**
- Left: Vendor name (bold, 0.85rem) + Note (tertiary, 0.7rem)
- Right: Bucket name + dot + date (secondary) | Amount (Lora, red for expenses)
- Delete button: appears on hover (desktop) or always visible (mobile)

**Uncategorized transactions:**
- Red left border `2px`
- Shows "Unassigned" label in red with `[Assign]` button

**Plaid transactions:**
- Small chain-link badge before vendor name (opacity 0.5)

**"Show more" button:** Secondary style, full width, below the list

---

### 4.7 Buttons

| Type | Background | Text | Border | Radius |
|---|---|---|---|---|
| Primary | Copper gradient `#C06535→#B55A30` | White | None | 24px pill |
| Secondary | Transparent | Secondary text | `1px solid rgba(0,0,0,0.12)` | 24px pill |
| Small | `rgba(181,90,48,0.08)` copper tint | Copper | None | 24px pill |
| Danger | `rgba(220,38,38,0.08)` red tint | Red | None | 24px pill |
| Icon | Transparent | Tertiary | None | 6px |
| Link Bank | Green gradient | White | None | 24px pill |
| Sync | `rgba(181,90,48,0.08)` | Copper | None | 24px pill |

**Hover effects:** -1px translateY + enhanced shadow on primary/secondary  

---

### 4.8 Toast Notifications

**Position:** Bottom-right, `1.25rem` margin  
**Style:** Near-black `rgba(26,22,20,0.92)` pill, white text  
**Error variant:** Red `rgba(220,38,38,0.92)`  
**Animation:** Slide-up + scale-in  
**Duration:** ~3s auto-dismiss  

---

### 4.9 PWA Install Banner

**Position:** Fixed bottom, full width  
**Background:** `rgba(255,255,255,0.96)` + blur  
**Contents:** App icon + install instruction text + dismiss `×`  
**Only shown** when the app isn't already installed  

---

## 5. User Flows

### 5.1 First-Time Setup
```
Landing (empty state)
  → Click "+ New Bucket"
  → Fill name, goal, pick color → Create
  → See bucket appear (stagger animation)
  → Click "Edit" beside Total Balance → Set balance
  → Optional: Click "Link Bank" → Plaid OAuth flow
```

### 5.2 Log a Purchase (Manual)
```
Click "Log Purchase" button
  → Modal opens
  → Enter amount ($)
  → Enter vendor name
  → Optional: Add note
  → Select bucket from dropdown
  → Submit
  → Bucket fill animates down
  → Transaction appears in list
  → Toast: "Purchase logged"
```

### 5.3 Sync Bank Transactions (Plaid)
```
Bank linked → "Sync" button in balance card
  → Loading state (spinner on button)
  → Modal: sync summary
      "12 new transactions pulled"
      "3 auto-assigned"
      "9 uncategorized"
  → Uncategorized appear red in transaction list
  → User clicks [Assign] on each → bucket dropdown
```

### 5.4 Transfer Between Buckets
```
Click "Transfer"
  → Modal: amount, from bucket, to bucket
  → Submit
  → Both buckets animate fill level
  → Toast: "Transferred $X from Y to Z"
```

### 5.5 Savings Pool Deposit
```
Switch to Savings pool tab
  → Buckets show as percentages
  → Click "Log Deposit"
  → Enter total deposit amount
  → Preview shows: each bucket gets X%
  → Confirm → all buckets fill proportionally
```

---

## 6. Responsive Behavior

### Desktop (>960px)
- Content centered, `max-width: 960px`
- Bucket grid: up to 3–4 columns
- Transaction delete button: opacity 0, reveals on row hover
- Swipe trigger `···` button: opacity 0, reveals on card hover

### Tablet (600–960px)
- Full width content
- Bucket grid: 2 columns
- Normal header/modal sizes

### Mobile (<600px)
- Single column bucket grid
- Section header stacks vertically (title above buttons)
- Action buttons flex-wrap, equal width
- Transaction rows: amount on same row as vendor, meta on second row
- Bucket visual height reduced to 130px
- Delete button always visible (top-right corner of row)
- Swipe trigger hidden (use touch swipe directly)
- Modal: 95% width

---

## 7. Proposed UI Improvements

### 7.1 Navigation Redesign
**Problem:** Everything is on one long scrolling page with no navigation. Finding settings, switching contexts, and accessing features requires scrolling.  

**Recommendation:** Add a bottom navigation bar (mobile) or side navigation (desktop):

```
Mobile Bottom Nav:
┌──────────────────────────────────────┐
│  [~]Home  [○]Buckets  [$]Txns  [⚙]  │
└──────────────────────────────────────┘
```

Tabs:
1. **Overview** — Balance card + summary bar + pool tabs
2. **Buckets** — Full bucket grid
3. **Transactions** — Full transaction list with search/filter
4. **Settings** — Plaid connection, pools management, auto-rules

### 7.2 Dashboard Overview Screen

Add a richer top-level view showing:
- Month-to-date spending vs. budget (large donut or bar)
- Top 3 most-used buckets
- Quick actions strip: [+ Purchase] [+ Deposit] [Transfer]
- Recent activity feed (last 5 transactions)
- Alert strip: "You have 4 uncategorized transactions"

### 7.3 Bucket Card Redesign Options

**Option A — Compact List View Toggle**
Allow switching between card grid and compact list. List shows: color dot, name, mini progress bar, amount remaining, quick-add button.

**Option B — Larger Visual Bucket**
Make the bucket fill taller (200px), add goal amount at top of vessel, spent at bottom. Better at-a-glance reading.

**Option C — Minimal Card (no vessel)**
Replace the decorative bucket vessel with a clean horizontal progress bar card — more modern, information-dense.

```
┌────────────────────────────────┐
│  ● Groceries          $240/$400│
│  ████████████░░░░░░  60%       │
│  $160 remaining · 8 days left  │
└────────────────────────────────┘
```

### 7.4 Transaction List Improvements

- **Search bar** at top of transactions section
- **Filter chips:** All | Uncategorized | This Month | By Bucket
- **Group by date** (Today, Yesterday, This Week, Older)
- **Batch assign:** Select multiple uncategorized → assign to one bucket
- **Swipe to delete** on mobile (currently only bucket cards swipe)

### 7.5 Balance Card Redesign

Current: 3 stats in a row, thin progress bar below  

**Improved:**
```
┌─────────────────────────────────────────┐
│  MY BUDGET · April 2026                 │
│                                         │
│  $3,200.00                    [Edit]    │
│  Available balance                      │
│                                         │
│  ████████████████████░░░░  87%          │
│  $2,800 of $3,200 allocated             │
│                                         │
│  $400 unallocated  ←→  $2,800 in buckets│
└─────────────────────────────────────────┘
```

### 7.6 Empty State Improvements

**Current:** Generic icon + "No buckets yet. Create your first one."

**Improved:** 
- Illustrated empty bucket vessel (matches the app metaphor)
- 3-step onboarding mini-guide: "1. Set your balance → 2. Create buckets → 3. Log spending"
- Example bucket templates: [Groceries] [Rent] [Entertainment] (one-tap add)

### 7.7 Onboarding Flow (New)

For first-time users, add a simple 3-step setup:
1. **"What's your balance?"** — Enter total account balance
2. **"Create your first buckets"** — Suggest common categories with quick-add
3. **"Link your bank? (optional)"** — Plaid connection with skip option

### 7.8 Pool Tab Improvements

**Current:** Plain underline tabs  

**Improved:** Show balance summary under each tab name:
```
[My Budget $3,200] [Savings $8,400] [+]
```

Or use pill-style tabs with icons:
```
[💳 Checking] [🏦 Savings] [+]
```

### 7.9 Notifications & Reminders

Add a bell icon in the header showing:
- Unread uncategorized transactions count
- Budget alerts (bucket > 80% spent)
- Sync status / errors

### 7.10 Dark Mode

The warm atelier palette has a clear dark mode direction:

| Light | Dark |
|---|---|
| `#F8F6F1` bg | `#1C1917` bg |
| `#FFFFFF` card | `#292524` card |
| `#F3F1EC` input | `#3C3735` input |
| `#1A1614` text | `#F5F5F4` text |
| `#B55A30` accent | `#D97757` accent (slightly lighter) |

---

## 8. Interaction Patterns

### Animations to Preserve
- Bucket fill level transitions (0.6s cubic-bezier ease) — this is the heart of the app's delight
- Wave animation on liquid surface — keeps the bucket metaphor alive
- Card stagger-in on load (60ms delay increments)
- Modal scale-in from 0.97
- Toast slide-up from bottom

### New Animations to Add
- **Balance number counter** — animate from old to new value when balance changes
- **Bucket card celebrate** — subtle confetti burst when a bucket hits 100%
- **Transfer animation** — liquid visually flows from one bucket to another
- **Pull-to-refresh** on mobile — refreshes Plaid sync
- **Skeleton loading** — warm gray placeholder cards while data loads

### Gesture Map (Mobile)
| Gesture | Element | Action |
|---|---|---|
| Tap | Bucket card | View bucket detail / transactions |
| Swipe left | Bucket card | Show: Delete |
| Swipe right | Bucket card | Show: Spend, Edit, Add Funds |
| Long press | Bucket card | Drag to reorder |
| Swipe left | Transaction row | Delete |
| Pull down | Page | Sync / refresh |
| Tap | Tab | Switch pool |

---

## 9. Accessibility

### Current Gaps
- Modal has `role="dialog" aria-modal="true"` — good
- Many interactive elements lack visible focus rings
- Color alone indicates bucket states (full/over) — needs non-color indicator
- Swipe actions not keyboard accessible

### Recommended Fixes
- Add `:focus-visible` outline in copper color on all interactive elements
- Add `aria-label` to icon-only buttons (`···`, `×`, sync spinner)
- Add `aria-live` region for toasts
- Add text alternatives for bucket fill percentage (not just visual)
- Keyboard shortcut for common actions: `N` = new bucket, `P` = log purchase
- Ensure all color states have icon/text backup (full bucket could show ✓ text)

---

## 10. Component Inventory for Stitch

### Atoms
- [ ] Color swatch (8 bucket colors + semantic colors)
- [ ] Typography scale (Lora display + Outfit body, all sizes)
- [ ] Icon set (20+ SVG icons: droplet, receipt, pencil, trash, sync, link, etc.)
- [ ] Button states: Primary, Secondary, Small, Danger, Icon (rest / hover / active / disabled)
- [ ] Input field (rest / focus / error states)
- [ ] Color picker swatch (32px circle, selected state)
- [ ] Badge (pool type `%` badge, copper pill)
- [ ] Progress bar / summary bar segment
- [ ] Color dot (8px, bucket color indicator)
- [ ] Status dot (6px pulsing green — connected state)

### Molecules
- [ ] Pool tab (active / inactive / add)
- [ ] Balance stat item (label + amount + optional button)
- [ ] Summary bar (multi-segment progress bar)
- [ ] Bucket visual (empty, 25%, 50%, 75%, 100%, over)
- [ ] Bucket card (full component with all states)
- [ ] Bucket card swipe state (left open, right open)
- [ ] Transaction row (normal, uncategorized, Plaid-imported)
- [ ] Rule row (pattern → bucket)
- [ ] Plaid account row (icon + name + type badge)
- [ ] Deposit preview row (bucket + amount)
- [ ] Toast (normal + error)
- [ ] Form group (label + input + hint + error)
- [ ] Pool type option (icon card — spending / savings)

### Organisms
- [ ] Header
- [ ] Pool tab bar
- [ ] Balance card (with summary bar + optional Plaid section)
- [ ] Bucket grid
- [ ] Empty state
- [ ] Transactions section (header + list + empty state)
- [ ] Modal shell (overlay + dialog + header + body)
- [ ] All modal contents (12 types listed above)
- [ ] PWA install banner

### Templates
- [ ] Main page layout (single page, all sections stacked)
- [ ] Mobile layout (<600px adaptations)
- [ ] Empty state page (no buckets)

---

## 11. Key Screens to Design in Stitch

1. **Main Page — Loaded State** (has balance, 4+ buckets, recent transactions)
2. **Main Page — Empty State** (first-time user, no buckets)
3. **Bucket Card — All Fill States** (0%, 33%, 66%, 100%, 120%)
4. **Bucket Card — Swipe Open Left** (delete action revealed)
5. **Bucket Card — Swipe Open Right** (spend/edit/funds revealed)
6. **Modal — New Bucket** (open, with color picker)
7. **Modal — Log Purchase** (filled out, bucket selected)
8. **Modal — Log Deposit — Savings Pool** (with deposit preview breakdown)
9. **Modal — Auto-Assign Rules** (with existing rules + add form)
10. **Transaction List** (mix of normal, uncategorized, Plaid)
11. **Plaid Connected State** (in balance card, accounts expanded)
12. **Mobile — Bucket Grid** (single column, 375px viewport)
13. **Mobile — Transaction Row** (wrapped layout, meta row)
14. **Mobile — Section Actions** (wrapped button row)
15. **Proposed: Bottom Nav Bar** (4 tabs)
16. **Proposed: Dashboard Overview** (with spending chart)
17. **Proposed: Compact List View** (bucket list alternative)
18. **Proposed: Dark Mode** (main page, dark palette)

---

## 12. File References

| File | Purpose |
|---|---|
| `public/index.html` | App shell, HTML structure |
| `public/style.css` | All styles (CSS vars, components, responsive) |
| `public/app.js` | All client logic, render functions, modal builders |
| `public/manifest.json` | PWA manifest (icons, name, theme) |
| `public/service-worker.js` | Offline caching |
| `server.js` | Express API (data CRUD, Plaid integration) |
| `data.json` | Persisted state (pools, buckets, transactions) |

---

*End of Design Document — April 2026*
