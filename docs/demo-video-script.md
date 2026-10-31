# Demo Video Shooting Script — 5 minutes

**Rule #1: record in segments, cut the boring parts.** Never fill a form on camera in real time — cut it to 2 seconds. The 5-minute budget only works with cuts.

---

## Pre-flight (do 30 min before recording)

1. **Fresh state** — the exact commands:
   ```bash
   docker compose down -v && docker compose up -d
   cd server && npx prisma migrate deploy && npx prisma db seed
   SCALE=5000 npx ts-node prisma/seed-scale.ts   # 5,000 subs — makes the dashboard claim literal
   npm run start:dev        # terminal 1
   cd ../Frontend && npm run dev   # terminal 2
   ```
2. **Verify logins once** (quick-fill buttons work but race — click quick-fill, then Sign in):
   - Admin `admin@brightloop.test` · Staff `staff@brightloop.test` · Customer `customer@brightloop.test` — all `Passw0rd!`
3. **Browser**: Chrome profile with NO other tabs, bookmarks bar hidden, zoom 110%, notifications off, window 1440×900.
4. **Numbers you will see** (say them confidently): dashboard shows **1,042 active subscriptions · ₹1.69 Cr collected · ₹2.17 Cr overdue**; the paid-off invoice is INV-000129 with balance **₹3,184.94**.
5. Recorder: 1440p+, capture mic + screen, cursor highlight ON.
6. If anything breaks mid-take: stop, `docker compose down -v` reset, start that segment over. **Never debug on camera.**

---

## Segments (record each separately, stitch)

### SEG 1 — Hook + Dashboard · 0:00–0:15 (15s)
**Screen:** admin dashboard, fully loaded, cursor still.
**Say:** *"This is Brightloop — one system that runs an entire subscription business: catalog, contracts, recurring billing, payments, and a customer portal. Built locally, no cloud."*
**Do:** nothing. Let the KPIs breathe (1,042 active · ₹1.69 Cr collected · ₹2.17 Cr overdue).

### SEG 2 — Admin configures the catalog · 0:15–0:45 (30s)
**Screen:** Products → Add Product dialog.
**Do:** type name/type/prices (speed up 4× in the cut), click Create → toast "Product created successfully."
**Say:** *"The admin launches a new product with pricing, then defines billing plans with minimum seat counts and availability windows, tax rules, and discount campaigns — everything the billing engine will use automatically."*
**Do:** quick 2-second flashes of the Plans, Taxes, Discounts pages (already populated).

### SEG 3 — Staff turns a quote into a contract · 0:45–1:25 (40s)
**Screen:** log out → Staff quick-fill → login (cut to after login).
**Do:**
1. Customers → New Customer → fill (cut) → created.
2. Subscriptions → New Subscription → pick customer, plan "Business Monthly", product ×2 seats → **Create Quotation** → toast "SUB-005003 created".
**Say:** *"Sales creates the customer, then builds the contract from the catalog — two seats of the suite. The moment it's saved it gets a contract number and enters the lifecycle."*

### SEG 4 — Lifecycle · 1:25–1:55 (30s)
**Screen:** subscription detail modal.
**Do:** click **Send Quotation** → status flips to Quotation → (cut) → **Confirm Quotation** → (cut) → **Activate Subscription** → Active badge. Point at the stepper: *Draft → Quotation → Confirmed → Active → Closed.*
**Say:** *"The contract moves through the lifecycle — quotation, confirmation, activation — and every transition is recorded with who did it and when."*

### SEG 5 — Billing day · 1:55–2:40 (45s) ⭐ the money scene
**Screen:** Invoices → Run Billing Now → modal.
**Do:** click **Execute Billing Run** → summary appears → pause 2s → point at numbers.
**Say:** *"Billing day. One click scans every active subscription due today and generates pre-filled invoices — taxes and discounts applied automatically, no typing."*
**Then:** click **Run Again (Verify Idempotency)** → **Created 0**.
**Say:** *"And if I run it again — zero. A database constraint makes double billing impossible, not just unlikely."* ⭐ slow down here.

### SEG 6 — The money comes in · 2:40–3:20 (40s)
**Screen:** Invoices list → first row Pay (INV-000129, balance ₹3,184.94).
**Do:**
1. Pay → ₹1,500 partial → Confirm → balance drops to ₹1,684.94, still Confirmed.
2. (cut) Pay again → ₹1,684.94 → Confirm → status flips to **Paid**, balance ₹0.00.
**Say:** *"Payments arrive by UPI, card, or bank transfer. Partial payments keep the invoice open with the exact balance; settling it flips the status to Paid automatically."*

### SEG 7 — The finance lead's questions · 3:20–3:50 (30s)
**Screen:** log out → Admin → Dashboard.
**Do:** point at each KPI, then the overdue list sorted by days overdue with contacts.
**Say:** *"How many active subscriptions? How much came in, how much is owed, what's overdue? One screen, live data, answered in under two seconds — even with five thousand subscriptions in the database."*

### SEG 8 — The customer portal · 3:50–4:30 (40s)
**Screen:** log out → Customer quick-fill → login → `/portal`.
**Do:** My Subscriptions (only THEIR contracts) → My Invoices → open one → browser Print preview (Ctrl/Cmd+P) → Esc.
**Say:** *"And customers never email support — they see their own subscriptions and invoices, and print them, through their own portal. Object-level access control means they only ever see their own data."*

### SEG 9 — Close · 4:30–5:00 (30s)
**Screen:** back on the dashboard, or a simple slide.
**Say:** *"Full subscription lifecycle, automated recurring billing, collections, reporting, and a self-service portal — running entirely on one local machine. Every scenario you saw is covered by 255 automated tests."*
**Do:** end on the KPI cards, 2s hold.

---

## Editing notes

- Cut every form-typing to ≤2s (speed up 4× or jump-cut).
- Keep the 2s pause after "Created 1" and before "Created 0" — that beat sells idempotency.
- Add captions for the money numbers (₹ figures, "Created 0").
- Background music under 20% volume; duck during voiceover.
- The fade-up entrance animations take ~1s per page — always wait 1.5s after navigation before cutting back in.

## Fallbacks

| Breaks | Do |
| --- | --- |
| Billing run slow (15s at 5k seed) | Narrate over it: *"scanning thousands of subscriptions"* — or cut mid-run |
| A dialog doesn't open | Reset DB + reload — the deadlock is fixed, but stale HMR needs a hard reload |
| Wrong numbers on dashboard | Re-seed — the narration numbers assume the fresh 5k seed |
| Login race (quick-fill) | Type manually — always works |
