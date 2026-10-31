# Demo Script — 6 minutes (one billing month at Brightloop)

One driver (Dev C, demo machine) · one narrator (walks the scenes below) · one on standby (judge questions, DB reset: `docker compose down -v && docker compose up -d`, migrate, seed).

Fresh DB before demo. One browser profile per role: admin, staff, customer.

| # | Scene (narrator says) | Actor | Action | Proof point |
| --- | --- | --- | --- | --- |
| 1 | "A new customer finds Brightloop online" | Customer | Signup — show weak-password rejection, then valid | AUTH rules; role lands in portal |
| 2 | "Not everyone sees the same things" | Admin | Log in — sidebar shows Catalog/Users; customer portal lacks them | Role guards |
| 3 | "Admin launches a new product" | Admin | Create product + **Odoo variant +₹560**, plan, 18% tax, 10% discount rule | Catalog config |
| 4 | "A sales rep turns a quote into a subscription" | Staff | Create customer + subscription with variant line → Quotation → Confirm → Activate | Lifecycle + history |
| 5 | "Billing day — hundreds due at once" | Staff | **Run billing** → invoices with tax + discount; **run again → 0 created** | No double billing |
| 6 | "The money comes in" | Staff | Partial payment → balance stays; complete → Paid; overdue filter | Payments logic |
| 7 | "The finance lead's questions, answered in one screen" | Admin | Dashboard KPIs + overdue list (500 seeded subs, instant) | Reports + <2s |
| 8 | "No more emailing anyone" | Customer | Portal: own subscriptions + invoices, print one | Portal + object auth |

**Never demo:** anything on the cut list (Plan.md §1). If something breaks live: reset DB, resume at the next scene — never debug on stage.
