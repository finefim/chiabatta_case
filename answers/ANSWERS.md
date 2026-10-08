# Ciabatta Club: my answers

Name: Efim Veleslavov
Tools: Claude as an AI coding agent, working on the case files (database, inbox, logs). The decisions and the ranking are mine.

Start with `ONE_PAGER.md`; this file has the detail. Unfamiliar words are explained in `GLOSSARY.md`. Every claim below has an ID you can look up in the back office (order, email, task or action), and the calculations live in `build/`.

---

## The number I steer by: profit per pair the customer keeps

About 1 in 4 pairs comes back, often because customers order two sizes and keep one. A sale only counts once the customer keeps the pair. So I measure **profit per kept pair**: money left from one kept pair after paying for the shoe, delivery, its share of returns, payment fees, disputes, the agents, Sam's salary and ads. In finance this is called CM3.

Numbers come from the shop's own profit calculator (Supplies page), recalculated in `build/kept_pair.py`:

| € per kept pair | After shoe and delivery (CM1) | After returns, fees, agents, Sam (CM2) | **After ads (CM3)** |
|---|---|---|---|
| **Whole shop** | 27.98 | 6.29 | **−11.11** (about −€26,000 a month on 2,366 kept pairs) |
| Ultra Comfort Loafer (Ciabatta) | 47.89 | −24.95 | −47.87 |
| Ultra Comfort (Ciabatta) | 22.12 | −15.90 | −37.25 |
| Portofino (Ortensi, the best line) | 33.79 | 12.60 | −4.54 |

**In plain words:**

- The shop covers its running costs: about +€15,000 a month before ads.
- Ads cost €18 per order, about €41,000 a month, and that turns the result negative.
- Ciabatta shoes lose the most. Ciabatta takes nothing back and 40–44% of its pairs are returned, so every unsold return is a full loss.

What each change does to profit per kept pair (whole shop, applied one after another):

| Change | Profit per kept pair | Change |
|---|---|---|
| Today | −€11.11 | |
| Kade-first routing + send old pairs back to Ortensi in time | −€4.08 | **+€7.03** |
| Fight disputes with the delivery scan | −€3.50 | +€0.58 |
| Cheaper agents | −€3.20 | +€0.30 |
| Pay Ortensi early for the 2% discount | −€2.49 | +€0.71 |
| *Elena:* Ciabatta refunds unsold returns | −€0.15 | +€2.34 |
| *Elena:* ads €18 → €12 per order | **+€5.65** | +€5.80 |

- **Kade-first is the biggest change in our hands**, which is why it's my top one.
- **Operational fixes alone don't make the shop profitable.** The last two rows are Elena's decisions.
- **Why the estimate is higher than what's proven today:** it assumes we resell 70% of "as new" returns. Testing on last month's orders, the router used 76%. Today the gain is smaller (€2,200 a month) because Kade has checked only 120 of 448 returns this month, and an unchecked pair can't be resold.

---

## 0. Before 12:00 UTC today (things that can't wait)

| # | What | Why today | Action |
|---|---|---|---|
| 1 | **Pay Ciabatta invoices CB-INV-0518, 0525, 0601 (€26,858)** | Otherwise Ciabatta stops shipping on Tue 16 June: about a third of our pairs (mail_0021, task T-1150). We're also over their €25,000 credit limit. | I rebuilt 0525 and 0601 from our own shipments and they match to the cent. 0518 is older than our data, so I pay it on trust and check with Sam later. |
| 2 | **Tell Ortensi: cancel order ORT-26-33678** | Two of our agents sent Ortensi opposite emails ("cancel" and "when will you ship?"). Ortensi ships its backlog today. The customer was already refunded €89. | One-line reply to Chiara at Ortensi. |
| 3 | **Run Kade-first** | 67 orders can still be cancelled at Ortensi before its 12:00 UTC batch; 18 at Ciabatta before 11:00 UTC. | `python3 build/kade_router.py plan` → 92 orders, 110 pairs, €3,302 saved. |
| 4 | **Renew the Ortensi access key** | It expired on 12 June. Our stock numbers froze, so the shop sells sizes Ortensi no longer has. The agent Leo skipped the warning email (mail_0016). | Elena has admin access; 10 minutes in Ortensi's portal. |
| 5 | **Answer the makers about held orders** | 4 orders have waited since 4 June because nobody answered Ortensi (mail_0009). Ciabatta holds 17 orders (mail_0018). | Ship what's ready now; Mia asks each customer to wait or swap. Kade can ship 7 of the missing items. |
| 6 | **Fight disputes; don't accept them** | 17 open, €2,763, and the courier shows every one delivered. Paolo proposes to accept CC-11202. | Reject that proposal and answer each dispute with the delivery scan. |
| 7 | **Clean the approval queue** (194 actions, oldest 64 h) | Some would lose money: a double refund (act_101268), refunds before Kade has the parcel, a 20% discount code (policy max 10%), cash refunds on unpaid invoices. | Approve the clean ones, reject or fix those. |
| 8 | **Tell Ortensi the new address for CC-11785** | The customer changed it on 10 June; nobody told Ortensi; it ships today. | Email Ortensi, or redirect the parcel with GLS (€6). |
| 9 | **6 orders for sizes already sold out** | The shop still shows stock (old data). | Mia asks the customers; Kade ships any it has. |

**For Elena** (prices, terms and partners are hers):

- **Ortensi +8%.** The notice came on 20 May for 1 June, 12 days instead of the 30 in the contract: €3,528 billed so far. The money agent approved it because its rule allows invoices up to 10% above expected.
- **Billing error.** 3 cancelled orders were billed (€219).
- **Early-payment discount.** We pay Ortensi on day 30 and miss the 2% discount for paying within 10 days: about €2,100 a month.
- **Ciabatta takes nothing back.** Asking for a refund on unsold returns adds €2.34 per kept pair.
- **Defect promise.** Our policy promises customers 12 months on defects, but Ciabatta only covers 6.
- **Paid ads** are the largest cost per kept pair (about €17).

---

## 1. Fix, kill, teach (in the order I'd do them)

| # | Type | What | Evidence | Money or time | Who I'd talk to |
|---|---|---|---|---|---|
| 1 | Fix | **Kade-first routing.** Before an order goes to the maker, code checks whether Kade has that exact shoe "as new"; if yes, Kade ships it. Old Ortensi pairs go back before their 60-day refund ends. | 168 "as new" pairs at Kade; 0 resold since 14 May (T-1021) | €3,302 today; €2,244 a month proven; up to €16,623 | Kade customer service |
| 2 | Fix | **File exchange with Ciabatta (SFTP)** instead of one email per order. | Login sent 9 March, skipped (mail_0002); 650 emails a month (mail_0005) | Up to 1 day faster delivery on a third of orders; fewer late cancels | Giada at Ciabatta |
| 3 | Fix | **Ortensi access key + alerts on every connection.** | 37 failed stock updates since 12 June; only 1 of 10 connections has an alert | Stops selling shoes that are gone | Elena, Ortensi IT |
| 4 | Fix | **Handoffs journal:** every question between agents and suppliers gets an owner and a deadline; anything late goes to a person. | 16 of 16 open with no owner on Monday (`build/handoffs.py`) | €4,278 at risk caught in time | — |
| 5 | Teach | **Paolo:** refund simple returns without a click once code confirms Kade received the pair, the amount is right, it wasn't refunded before, no open dispute; pay-later orders get a credit note. | 44 refunds waiting; 2 double refunds (CC-11109, CC-10662) | ~3.5 h of Sam's time a month; 0 double refunds | Elena (when to stop asking) |
| 6 | Teach | **Mia:** no discount codes to smooth things over, no refund before Kade has the parcel, defects over €100 get a return label, address changes reach the maker. Read only the products she needs. | Codes of 10–20% (act_101249, 101256, 101265); 32 address tasks for Sam | Half of Mia's €418 a month; fewer giveaways | Sam (tone of voice) |
| 7 | Kill | **Tina asking GLS every 15 min.** GLS notifies us instead (webhook). | €575 a month; 965 orders got the "on its way" email more than once | €575 a month | — |
| 8 | Kill | **Nora's hourly summary.** The automatic checker of the handoffs journal replaces it. | 48 summaries said "no critical issues" while the queue grew to 190 | €126 a month | — |
| 9 | Kill | **"Accept any dispute under €150".** Fight with the delivery scan by default. | 5 accepted, 4 lost; all delivered | ~€1,200 a month | — |
| 10 | Kill | **Paying an AI model just to run an approved action.** Plain code runs it, and it can never run twice. | 751 runs, €184 a month | €184 a month | — |

**Kept human on purpose: talking to the makers.** Seven complaints about the Positano strap since 1 June, and one customer sprained her ankle (CC-10691). The April defect claim with Ortensi was settled on a call: "claims by email go nowhere" (T-1055). An agent can prepare the list of orders and photos; the call, and what we trade, stays with a person.

---

## 2. My top one, done: Kade-first routing

**What it is.** `build/kade_router.py`, a Python script. Plain code makes every decision; no AI is involved. An agent only sends the messages the script writes.

```bash
python3 build/kade_router.py plan        # today's plan → build/out/
python3 build/kade_router.py backtest    # test it on last month's orders
python3 build/kade_router.py selftest    # 11 automatic checks
python3 build/kade_router.py plan --now 2026-06-15T11:30:00Z   # try a later time of day
```

**How it decides:**

1. **Is the whole order on Kade's shelf, "as new", in the exact shoe and size?** It takes the oldest pair first, because that one is closest to losing Ortensi's refund. Orders already waiting for out-of-stock shoes go first.
2. **Can we still stop the maker?**
   - Ortensi: only while the order is "received" or "on hold", before its 12:00 UTC batch.
   - Ciabatta: only before they type the email order in (11:00 UTC).
   - Later than that, cancelling fails. That's why 14 orders this spring ended up shipped and returned.
3. **Does it save money?** Saving = the new pair + the maker's delivery fee − Kade's shipping fees − the Ortensi refund we give up by not sending that pair back. Ship from Kade only if we save at least €1.
4. **What's left on the shelf:** Ortensi pairs older than 45 days go on a pallet back to Ortensi before day 60.

**When it asks a person:** when only part of the order is at Kade (a split means a second parcel), when the customer has an open conversation or a pending change, or when the maker refuses the cancellation.

**Results on the data** (Monday 06:30 UTC):

- Today: 92 orders, 110 pairs from Kade, **€3,302 saved**. 7 split orders go to a person.
- Last month, order by order: 128 orders could have shipped from Kade, **€2,244 saved**. What actually happened: 0 pairs resold.
- 11 automatic checks pass, including:
  - no pair promised twice;
  - only orders the maker can still stop;
  - nothing moves after the cut-off times;
  - an order with a pending cancellation is left alone.
- Against a copy of the mock systems: 69 Ortensi cancellations accepted. Running it a second time is refused, so it can't cancel twice.

**When it can run without a person approving:** after one week of daily plans approved by me with 0 wrong reroutes and every pick confirmed by Kade.

**Honest limits:**

- Ortensi pairs still inside their 60-day refund save only about €6 each. The real money is Ciabatta pairs and Ortensi pairs past 60 days.
- Kade's system has no "create order" function, so for now it's a daily pick-list email.
- The bigger prize needs Kade to check returns on time: today 92 delivered returns are unchecked.

---

## 3. My first two weeks

| Priority | Number that shows it worked by day 14 | How it helps one person run 2,000 customers |
|---|---|---|
| 1. Stop the money leaking: Kade-first daily, pallet to Ortensi before day 60, fight disputes, Elena's questions answered | Profit per kept pair from −€11 towards −€4; 25+ orders a week shipped from Kade; 0 disputes accepted on delivered orders | The Friday matching (80 min) and dispute paperwork become code with a short exceptions list |
| 2. Approval queue under control: code runs approved actions; Paolo's simple refunds after a trial week; Mia's new instructions; handoffs journal | Oldest waiting action under 4 h every morning (today 64 h); 60% of refunds without a click; 0 double refunds; 0 handoffs without an owner | What's left needs judgement, not 190 clicks |
| 3. Supplier connections that don't need a person: Ciabatta file exchange, Ortensi key with a second admin, alerts everywhere, GLS notifications | 0 email orders to Ciabatta; stock data never older than 3 h; agents under €300 a month | Stock, tracking and orders flow without typing |

The day-by-day version is in the back office **Plan** tab.

---

## Appendix: what I checked

**Supplier agreements read:** both makers' full terms (Supplies page), Ciabatta's onboarding pack, Ortensi's price-list email. All proposals stay within them (60-day refund, 30-day notice, credit limits, 2% discount, credit hold, rebate, defect periods, discount caps).

**Data checks that came back clean:**

- order totals match their lines;
- one payment per order, never refunded more than paid, no return refunded twice by its return number;
- every cancelled order refunded;
- every "delivered" order has a delivery scan;
- every Kade pair links to a return.

**Problems found:**

- **Double refunds** outside the return number: CC-11109, CC-10662.
- **Address changes:** 12 never reached the maker, 11 of them already shipped.
- **Stale stock:** the shop shows stock the makers say is gone, and 6 orders came in after the warnings.
- **Kade's backlog:** 328 of 448 returns this month not yet checked.
- **Reviews** average 2.79 out of 5. Almost every low review praises the shoe and complains about slow refunds or too many emails.
