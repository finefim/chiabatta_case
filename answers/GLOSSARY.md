# Glossary: the words in plain English

## The business

| Word | Meaning | Example |
|---|---|---|
| Ciabatta, Ortensi | The two shoe makers. Each ships our orders straight to the customer. | Ultra Comfort and Loafer come from Ciabatta; Capri, Amalfi, Positano, Ischia and Portofino from Ortensi. |
| Dropship | The maker ships to our customer; we never hold the shoes ourselves. | Ortensi charges €7.90 per parcel for this, Ciabatta €6.50. |
| Kade | The returns warehouse in Venlo, Netherlands. It checks every returned pair and grades it. | 168 pairs are on Kade's shelves today. |
| Grade A / "as new" | A returned pair Kade found perfect. We already own it and can sell it again. | 81% of returns are grade A. |
| Grade B / C | B = needs work (Ortensi takes it back); C = write-off. | |
| Ortensi's 60-day credit | Ortensi refunds the full cost of an unsold returned pair if it reaches them within 60 days of Kade's check. | A €58 Amalfi pair sent back on day 50 = €58 back; on day 61 = nothing. |
| Wholesale price | What we pay the maker per pair, before VAT. | Loafer: €68. |
| Size-try order | A customer orders 2–3 sizes and keeps one. | A big reason 44% of Loafers come back. |
| Dispute / chargeback | The customer asks their bank or PayPal for the money back. Without proof (the courier's delivery scan), we lose the money plus a €15 fee. | CC-11202, €139, delivered on 6 June. |
| Credit hold | The supplier stops shipping our orders until we pay overdue invoices. | Ciabatta threatened this for 16 June. |
| Pay later | The customer pays an invoice within 14 days. A refund is then a credit note, not money back. | |

## Money

| Word | Meaning | Example |
|---|---|---|
| Kept pair | A pair the customer keeps. About 1 in 4 pairs comes back, so we measure money per pair that stays sold. | 3,200 pairs shipped a month, about 2,366 kept. |
| Profit per kept pair (CM3) | Money left from one kept pair after the shoe, delivery, its share of returns, payment fees, disputes, agents, Sam's salary and ads. CM3 = "contribution margin, level 3". | Today: −€11.11, so we lose €11.11 on each kept pair. |
| CM1, CM2 | The same profit at earlier steps. CM1 = after shoe and delivery. CM2 = also after returns, fees, agents and Sam. CM3 = also after ads. | Shop today: CM1 €27.98, CM2 €6.29, CM3 −€11.11. |
| Proven | Recalculated from the shop's real data of the last 30 days. | Kade-first: €2,244 a month. |
| Estimate (model) | What the shop's own profit calculator (Supplies page) says once a change runs fully, with only that change made. | Kade-first: €16,623 a month. |
| One-off | Money that comes once, not every month. | €3,302 from rerouting today's 92 orders. |

## Systems and agents

| Word | Meaning | Example |
|---|---|---|
| Agent | An AI assistant with one job. | Mia (customers), Leo (suppliers), Tina (tracking), Paolo (money), Nora (coordination). |
| Prompt | The written instructions an agent follows. | Mia's prompt told her to offer discount codes to unhappy customers. |
| Agent spend | What we pay the AI provider, by the amount of text agents read and write. | €1,306 in 30 days. |
| Approval queue | Actions an agent proposes that wait for a person to click "approve". | 194 waiting, the oldest for 64 hours. |
| Trial week (shadow mode) | The agent only suggests and a person decides; we compare. If they always agree, the agent may act alone. | Paolo's refunds, 17–24 June. |
| Can never run twice (idempotency key) | Each action carries a unique label, so a double click can't refund a customer twice. | Stops repeats of the double refund on CC-11109. |
| API | A way for two computer systems to talk directly. | We place Ortensi orders through its API. |
| Access key (API token) | The password our system uses for Ortensi's API. It expires every 90 days. | Expired 12 June; stock numbers froze. |
| Webhook | The courier tells us the moment a parcel is scanned, instead of us asking every 15 minutes. | GLS offers this for free. |
| File exchange (SFTP) | A shared folder with Ciabatta: we drop order files, they drop stock and tracking files. | Replaces 650 emails a month. |
| Handoff | Any moment one agent or supplier needs someone else to act. | Ortensi asks: "ship part of the order now, or wait?" |
| Handoffs journal | One list where every handoff has an owner and a deadline. | 16 handoffs, all without an owner today. |
| Who-owns-what table | A fixed table in code: topic → owner → deadline. | Prices and terms → Elena, 72 hours. |
| Automatic checker (watchdog) | Code that checks the journal every 15 minutes and passes anything late to a person. | |
| Replay / tested on last month | Feeding last month's real orders or messages through new logic, in time order, to see what it would have done. | Kade-first replay: 128 orders could have shipped from Kade. |
| SKU | One exact product: model + colour + size. | CAP-BLK-42 = Capri, black, size 42. |
| Supplier order statuses | Ortensi: RICEVUTO (received), IN_LAVORAZIONE (being made, too late to cancel), SOSPESO (on hold), SPEDITO (shipped). Ciabatta: EMAILED (not keyed in yet), CONFIRMED (too late to cancel), OUT_OF_STOCK. | |
