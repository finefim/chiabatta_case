# Ciabatta Club: one-page summary

Efim Veleslavov · covering for Sam, Monday 15 June 2026

## The short version

- **The shop loses money on every pair a customer keeps: about €11 per pair, roughly €26,000 a month.** That is after paying for the shoe, delivery, returns, payment fees, agents, Sam's salary and ads.
- **Before ads it makes about €15,000 a month. Ads cost about €41,000 a month** (€18 per order). So the shop is buying growth it can't yet pay for.
- **The biggest fix in our hands:** stop buying new shoes when an "as new" returned pair of the same shoe is already sitting in the returns warehouse (Kade). Proven on last month's orders: €2,200 a month. Once Kade checks returns on time: up to €16,600 a month.
- **The two biggest levers belong to Elena** (the founder decides prices, terms and partners): cheaper ads, and getting Ciabatta (one of the two shoe makers) to take back unsold returns.

## What we found

| # | Finding | Evidence | What it costs |
|---|---|---|---|
| 1 | 168 "as new" returned pairs sit unsold at Kade while we buy the same shoes new. Nothing has been resold since Sam stopped doing it by hand on 14 May | `kade_stock` table; Sam's tasks T-1003…T-1021 | €2,200–16,600 a month |
| 2 | Ciabatta takes no returns back, and 40–44% of its shoes are returned | Supplier terms; `returns` table | We lose €37–48 on every Ciabatta pair kept |
| 3 | Ortensi (the other maker) raised prices 8% with 12 days' notice instead of the 30 its contract requires. 3 cancelled orders were billed | Inbox mail_0003; invoice FT-2026/0462 | €3,528 + €219 once |
| 4 | We always pay Ortensi on day 30 and never take the 2% discount for paying within 10 days | Supplier terms; invoices | about €2,100 a month |
| 5 | The money agent (Paolo) accepts every customer dispute under €150, even when the courier shows the parcel was delivered | Paolo's prompt; `disputes` table | €1,195 lost in 30 days |
| 6 | The AI agents cost €1,306 a month. 44% of it is one agent (Tina) asking the courier "anything new?" every 15 minutes | `agent_runs` table | €1,256 a month could be saved |
| 7 | Questions between agents get lost in a group chat. 16 open issues had no owner on Monday, for 7 days in the middle case | Inbox + agent chat, tested in `build/handoffs.py` | €4,278 at risk; a credit hold from Ciabatta the next day |

## What we propose, biggest money first

| # | Proposal | Who decides | Proven on real data | Estimate once running |
|---|---|---|---|---|
| 1 | **Kade-first:** ship from Kade's returned stock before buying new; send old Ortensi pairs back before their 60-day refund runs out | Ops (me) | €2,244 a month + €3,302 once today | €16,623 a month |
| 2 | Cut paid ads from €18 to €12 per order, starting with the Ciabatta shoes | Elena | no history | €13,722 a month |
| 3 | Ask Ciabatta to refund unsold returns, like Ortensi does | Elena | no history | €9,371 a month (≈ €5,600 if #1 already runs) |
| 4 | Hold Ortensi to the 30-day notice; ask for a credit for the 3 cancelled orders | Elena | €3,747 once | — |
| 5 | Pay Ortensi within 10 days to get the 2% discount | Elena | ~€2,100 a month | same |
| 6 | Fight disputes with the courier's delivery scan | Ops | €1,195 lost last month | €1,374 a month |
| 7 | Make the agents cheaper: plain code for simple jobs, less reading per job, smaller AI models | Ops | €1,256 a month | same |
| 8 | Handoffs journal: every question gets one owner and a deadline; anything late goes to a person within 24 hours | Ops | €4,278 at risk caught in time | protects #1–6 |

"Proven" = recalculated from the shop's real data of the last 30 days. "Estimate" = the shop's own profit calculator (Supplies page) with only that one change. #1 and #3 overlap.

## Fix, kill, teach

**Fix (build or set up once)**

1. **Kade-first routing.** Already built and tested (`build/kade_router.py`): 92 orders can ship from Kade today.
2. **File exchange with Ciabatta (SFTP).** Orders go as a file every 30 minutes instead of one email each. Ciabatta sends stock and tracking files back.
3. **Ortensi access key.** It expired on 12 June, so our stock numbers froze and the shop sells shoes that are gone. Renew it, add a second admin, alert on every connection.
4. **Handoffs journal.** One list with an owner and a deadline per question, plus an automatic checker.

**Kill (stop doing)**

1. Tina asking the courier every 15 minutes. The courier can notify us instead (webhooks). Saves €575 a month and the duplicate "on its way" emails.
2. Nora's hourly summary. It said "no critical issues" while 190 actions waited. The automatic checker replaces it.
3. Paolo's "accept every dispute under €150" rule.
4. Paying an AI model just to carry out an action a person already approved. Plain code does it, and it can never run twice.

**Teach (change an agent's instructions, with a test)**

1. **Paolo:** refund simple returns on his own once code confirms Kade received the pair, the amount is right, and it wasn't refunded before.
2. **Mia (customer agent):** no discount codes to smooth things over, no refund before Kade has the parcel, and address changes must reach the shoe maker.
3. **Leo (supplier agent):** an order counts as placed only when Ortensi accepts it, not on any reply. Passwords and supplier questions go to a person, never "skipped".

**Keep human:** talking to the makers (the weekly call with Ortensi, defect claims), the customer who was injured by a broken strap, and any price, term or partner decision.

## How to see it

Run `start.command` (or `node api/server.mjs`), then open http://localhost:8787/admin/#/approach:

- **Approach:** start here. North Star, three levers, this page in short, links to the rest.
- **Impact:** today vs. with the changes; switch changes on and off.
- **Plan:** two weeks, day by day.
- **Handoffs:** the lost questions, tested on real history.

Words explained: `answers/GLOSSARY.md`.
