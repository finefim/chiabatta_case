# How Ciabatta Club works

## Two suppliers, both dropshipping

| | Ciabatta | Ortensi |
|---|---|---|
| What | Ultra Comfort flip-flop, Loafer, Socks | Handmade line: Capri, Amalfi, Positano, Ischia Slide, Portofino |
| Ships from | Ciabatta DC, Bergamo (GLS) | Workshop, Porto Sant'Elpidio (GLS) |
| How we order | Leo emails orders@ciabatta.example, one email per order | Leo calls Ortensi's B2B API |
| When they process | Since 1 June, email orders once a day at 13:00 Italian time; ship the next working day | One batch per working day at 12:00 UTC; usually ship the same day |
| Stock | A one-off upload Sam did on 2 May | A stock feed every 2 hours |
| Order IDs | `CB-58xxx` | `ORT-26-3xxxx` |
| Statuses | `EMAILED`, `CONFIRMED`, `SHIPPED`, `OUT_OF_STOCK`, `CANCELLED` | `RICEVUTO`, `IN_LAVORAZIONE`, `SPEDITO`, `SOSPESO`, `ANNULLATO` |
| Invoices | Weekly PDF every Monday, 14 days net, €6.50 dropship per parcel; a human approves each one | Weekly on Fridays, 30 days net, €7.90 GLS per parcel; Paolo approves within 10% |
| Returns | Not taken back | Credits unsold returned pairs received within 60 days of Kade's scan |
| Cash discount | None | 2% if paid within 10 days |
| Late payment | Credit hold after a final written reminder once anything is more than 7 days overdue; statutory interest + €40 per invoice | Statutory interest + €40 per invoice |
| Credit limit | €25,000 open balance | €120,000 open balance |
| Price changes | 60 days' notice | 30 days' written notice |

The full wholesale terms for both makers are on the back office's Supplies page.

Ciabatta's onboarding pack is in `inbox/attachments/`. Ortensi's API can create orders, cancel orders that are `RICEVUTO` or `SOSPESO`, report status and (with a valid token) report stock. It can't change addresses or split orders; that needs an email to ordini@ortensi.example.

The shop shows a size as available when the latest stock data for it is above zero.

## A return's life

1. The customer asks for a return and gets a free DHL label.
2. DHL delivers the parcel to Kade Returns in Venlo.
3. Kade scans and grades the pair (A: resellable, B: needs work, C: not resellable) and sends a file of the day's receipts at 05:00 UTC.
4. Paolo proposes the refund, and a human approves it.

About a quarter of pairs come back. Many come from size-try orders, where a customer buys two or three sizes and keeps one. Socks can't be returned once worn.

### What happens to a returned pair

- **Grade A** stays at Kade for resale. When a new order is for a SKU that Kade has in grade A, it should ship from Kade: we already own that pair, and Kade's resale fulfilment is cheaper than a new pair plus the dropship fee.
- **Grade B** goes back to the supplier where the supplier takes it (Ortensi, within 60 days, full credit). Grade A pairs that don't sell in time should go back too.
- **Grade C** is written off, unless it's a defect we can claim.

### Kade's fees

| What | Fee |
|---|---|
| DHL return label (customer to Kade) | €8.40 per parcel |
| Receipt scan and grading | €1.60 per pair |
| Storage | €0.40 per pair per month |
| Resale order: processing / pick / packing / box | €0.30 / €0.30 per pair / €0.95 / €0.80 |
| Resale order: DHL delivery | €4.40 per parcel |
| Return pallet to Ortensi | €0.90 per pair |

## Money

- Card payments have IDs starting `pi_`, refunds `re_`; card refunds take 5–10 days to reach the customer. PayPal payments start `PAYID-`, refunds `PPR-`. Pay later: an invoice (`INV-…`) due in 14 days; refunds are credit notes (`CN-…`).
- Payment fees: 1.9% card, 2.9% PayPal, 2.5% pay later. Disputes cost a €15 fee when lost or accepted.
- Our cost prices are in `products.wholesale_price_eur`, excluding VAT. Customer prices include VAT; for margin maths, assume 20%.
- Paid ads cost about €18 per order.

## People

- Sam, the operator, costs €4,800 a month all-in.
- What the agents cost is in `agent_runs`. How they're built is in `agents/`.

## Models

| Model | Input €/1M tokens | Cached input | Output |
|---|---|---|---|
| `model-L` | €4.50 | €0.45 | €22.50 |
| `model-M` | €0.90 | €0.09 | €4.50 |
| `model-S` | €0.20 | €0.02 | €1.00 |

## Integrations

The `integrations` table lists every connection, what runs it and when it last worked.
