# Mock APIs

```bash
node api/server.mjs          # http://localhost:8787 (PORT=… to change)
```

These imitate the systems the agents use. They load `data/csv/` at start-up, not `ciabatta.db`, so restart the server after editing a CSV. Changes made through the API stay in memory until you restart. Every write, sent message and email is appended to `api/outbox.jsonl`. Nothing is really sent.

The clock is frozen at 2026-06-15 06:30 UTC.

The same server hosts the shop at http://localhost:8787 and the staff admin at http://localhost:8787/admin/. The admin uses these endpoints plus a few read-only `/admin/*` summaries. Case files download from `/files/…`.

## Shop

| Method | Path | Notes |
|---|---|---|
| GET | `/shop/orders/{order_id}` | Order with lines, supplier order, payments and returns |
| PATCH | `/shop/orders/{order_id}/address` | Body: any of `ship_street`, `ship_line2`, `ship_postcode`, `ship_city` |

## Ortensi B2B (supplier, in Italian)

| Method | Path | Notes |
|---|---|---|
| GET | `/ortensi/ordini?stato=RICEVUTO` | List orders; `stato` optional |
| GET | `/ortensi/ordini/{ordine}` | One order |
| POST | `/ortensi/ordini` | Body: `{"riferimento":"CC-…","righe":[{"articolo":"CAP-BLK-42","quantita":1}],"indirizzo":{…}}` |
| POST | `/ortensi/ordini/{ordine}/annulla` | Cancel |
| GET | `/ortensi/giacenze` | Stock |

Glossary: *ordine* order, *riferimento* our reference, *righe* lines, *articolo* item, *quantita* quantity, *stato* status, *esito* outcome, *messaggio* message, *giacenze* stock, *annulla* cancel.

## Carriers

| Method | Path |
|---|---|
| GET | `/gls/track/{tracking_number}` |
| GET | `/dhl/track/{tracking_number}` |

## Kade Returns

| Method | Path | Notes |
|---|---|---|
| GET | `/kade/returns?status=expected` | `expected` (label made, not yet scanned) or `received` |
| GET | `/kade/returns/{return_id}` | |
| GET | `/kade/stock?status=available&sku=CAP-BLK-41` | Pairs on Kade's shelves; both filters optional |

## Payments

| Method | Path | Notes |
|---|---|---|
| GET | `/payments?order_id=CC-…` | Charges and refunds |
| POST | `/payments/refunds` | Body: `{"order_id","amount_eur","reason","return_id?","idempotency_key?"}` |
| GET | `/payments/disputes?status=open` | |
| POST | `/payments/disputes/{dispute_id}/accept` | Accepts the dispute; the provider refunds the buyer and charges the fee |
| POST | `/payments/disputes/{dispute_id}/contest` | Body: `{"evidence":"…"}` |

## Helpdesk

| Method | Path | Notes |
|---|---|---|
| GET | `/helpdesk/conversations?status=open` | |
| GET | `/helpdesk/conversations/{conversation_id}` | With messages and agent actions |
| POST | `/helpdesk/conversations/{conversation_id}/reply` | Body: `{"body":"…"}` |

## Agent actions (the approval queue)

| Method | Path | Notes |
|---|---|---|
| GET | `/actions?status=pending&review_today=1&agent=mia` | All filters optional |
| POST | `/actions/{action_id}` | Body: `{"decision":"approve"|"edit"|"reject","args":{…}?,"note":"…"}`. Records the decision (tools don't run in this sandbox). A decided action can't be decided again (409). |

## Mail

| Method | Path | Notes |
|---|---|---|
| POST | `/mail/send` | Body: `{"to","subject","body"}` |
