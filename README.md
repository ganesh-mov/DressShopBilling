# 👗 Dress Shop Billing — Offline Edition

A complete, **100% offline** billing & inventory system for a clothing store.
No internet connection, no server, no monthly fees, no installation required.

## How it works

- Runs entirely in your browser (Chrome/Edge/Firefox) as a local app.
- Data is stored in **IndexedDB**, a database built into the browser itself.
  It lives permanently on this computer, in this browser profile, until you
  clear browser data — so **back it up regularly** (see below).
- No npm install, no build step, no dependencies. Just open `index.html`.

## Getting started

1. Download/clone this folder onto the shop computer.
2. Double-click `index.html` — it opens in your default browser.
   - **Recommended:** use Chrome or Edge, and "Install as app" from the
     browser menu (⋮ → Install App) so it opens like a normal desktop
     program with its own window, works offline, and shows on the taskbar.
3. Log in with the default account:
   - Username: `admin`
   - Password: `admin123`
   - **Change this immediately** by creating your own owner account under
     Users & Roles, or at minimum note this down and restrict who can access
     the computer.
4. Go to **Settings** and fill in your Shop Name, Address, GSTIN, and
   default GST rate.
5. Go to **Products** and add your first item. A barcode is generated
   automatically for every size/color combination.
6. Go to **Barcode Print** to print labels (connect any label printer —
   Zebra, TSC, XPrinter, TVS — as your default printer and use your browser's
   Print dialog; select the matching label size).
7. Go to **Billing** — plug in any USB barcode scanner (it types like a
   keyboard, no drivers needed), click into the scan box, and start scanning.

## Features included in this build

- Product management with size/color variants, each with its own barcode
- Automatic Code128 barcode generation (built from scratch, no external library)
- Barcode label printing (single item, selected items, or entire stock)
- Billing screen with scan-to-add, live totals, GST, discounts
- Payment methods: Cash, UPI, Card, Split payment, Credit customer
- Invoice printing (80mm thermal layout via browser print; use "Save as PDF"
  in the print dialog for a PDF copy, or select an A4 printer for A4 layout)
- Automatic stock deduction on every sale, and restock on returns
- Dashboard: today's sales, bills, profit, low stock alerts
- Customer management with phone, birthday, loyalty points, purchase history
- Reports: daily/weekly/monthly sales, profit, GST collected, stock value,
  best-selling & slow-moving products, employee sales
- Invoice search, reprint, and returns (auto-restocks items)
- User roles: Owner / Manager / Cashier
- Dark mode
- Local JSON backup & restore (Settings page) — this is your "cloud backup":
  download the file and store it on a USB stick, Google Drive, WhatsApp to
  yourself, etc. Restoring loads that file back into the app.

## Backing up your data (important!)

Since everything is stored only on this computer, **make backups often**:

1. Go to **Settings → Download Backup (.json)**.
2. Save that file somewhere safe (USB drive, email it to yourself, Google
   Drive folder, etc.) — ideally every day after closing.
3. If you ever switch computers or the browser data gets cleared, use
   **Settings → Restore Backup** with that file to get everything back.

## Not yet built (roadmap ideas)

These were in the original spec and are good next additions:
- WhatsApp/Email invoice sending (needs an internet connection + API keys,
  so intentionally left out of the offline core — can be added as an
  optional online feature later)
- Multi-store sync (would need a shared server or cloud database — breaks
  the "fully offline" requirement, so treat as a future paid upgrade)
- Purchase order management for incoming stock from suppliers
- Expense tracking (rent, salaries, electricity) for true net-profit reports
- Electron packaging for a native desktop `.exe`/`.dmg` icon instead of a
  browser tab (the app code itself doesn't need to change for this)

## Tech stack actually used (and why it differs from the original brief)

| Original ask | What's built | Why |
|---|---|---|
| PostgreSQL | IndexedDB (built into browser) | Free, zero-install, works with no internet, no server to maintain |
| Node/Express backend | None — pure client-side | Removes a moving part that could break in a shop with no IT support |
| React + Tailwind | Vanilla HTML/CSS/JS | No build tools needed; works by just opening the file |
| JsBarcode/BWIP-JS | Custom Code128 generator | No CDN/internet dependency |

If you later want cloud sync, multi-store support, or WhatsApp/Email
invoices, those need an always-on internet connection and a real backend —
happy to build that as a v2 on top of this.

## License

MIT — do whatever you like with it.
