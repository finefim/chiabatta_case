# Data

`data/ciabatta.db` (SQLite) and `data/csv/` hold the same tables. Times are UTC in ISO 8601. The data is a snapshot taken at 2026-06-15 06:30 UTC and covers the 30 days before it. Statuses show where things stand at the snapshot, so to see what was true when a past case was opened, rebuild it from the timestamps.

Full message text is kept for open conversations only. For closed conversations, the conversation keeps its metadata, and past `send_reply` actions keep the template name and language they were drafted with, not the text.

## How it connects

Follow one order and you've seen the whole operation. An order (`orders`, `order_lines`, `payments`) goes to its maker (`supplier_orders`), ships (`tracking_events`, outbound) and Tina emails the customer (`customer_messages`). If the customer writes in, that's a `conversations` row with its `customer_messages`, and the agents propose actions (`agent_actions`) that a human approves. A return (`returns`) travels back to Kade (`tracking_events`, return), lands on Kade's shelves (`kade_stock`) and is refunded (`payments`). The makers bill us weekly (`supplier_invoices`, `supplier_invoice_lines`).

Around that: everything Sam did by hand is in `tasks` and `task_steps`; email from suppliers, Kade and payment providers is in `inbox/ops_inbox.jsonl`; and the agents' own talk and work are in `logs/agent_channel.jsonl`, `logs/agent_trace.jsonl` and `agent_runs`. `order_id` joins almost everything, and emails and posts mention IDs in their text. In the back office, opening any row with an order shows that order's story in time order.

## Loading elsewhere

```bash
# Postgres / Supabase
psql "$DATABASE_URL" -f data/schema.sql
for t in $(ls data/csv | sed 's/.csv$//'); do
  psql "$DATABASE_URL" -c "\copy $t from 'data/csv/$t.csv' csv header"
done
```

DuckDB and pandas read the CSVs directly.

## Tables

**products**: one row per SKU (`CAP-BLK-42` = Capri, black, size 42). `retail_price_eur` includes VAT. `wholesale_price_eur` is our cost from the maker, excluding VAT. `supplier_stock` and `stock_updated_at` come from the Ortensi stock feed for Ortensi SKUs, and from Sam's manual upload of Ciabatta's stock list for Ciabatta SKUs. `fit_note` is the size advice customers see.

**orders**: one row per shop order. `status` is the shop's view: `awaiting_supplier`, `shipped`, `delivered` or `cancelled`. `ship_*` is the delivery address in the shop. `customer_email` and `customer_language` (the language they write in) identify the customer; `customer_id` stays the same across their orders.

**order_lines**: items in each order. `lot` is Ortensi's production lot, reported when the item ships.

**supplier_orders**: our mirror of each order at the supplier. `supplier` is `Ortensi` or `Ciabatta`, and `status` uses that supplier's own words (see `systems.md`). `supplier_note` is the supplier's free-text note or reply.

**tasks**: everything Sam did by hand, one row per task, including open tasks the agents handed over while Sam is away. `title` and `tags` are Sam's own, so they're inconsistent. `minutes_spent` is Sam's time. `sam_note` is what Sam wrote down.

**task_steps**: each step of each task: who did it (`actor`), in which system, what they did, how long it took and what came of it.

**reviews**: product reviews on the shop, with the order they came from.

**tracking_events**: GLS events for outbound parcels (`direction = 'outbound'`) and DHL events for returns (`direction = 'return'`).

**returns**: one row per returned item. `label_tracking` is the DHL number. `kade_received_at` is Kade's receipt scan; `grade` is Kade's grading.

**payments**: charges and refunds. `kind` is `charge` or `refund`. `status` uses each provider's own words: card `succeeded`, PayPal `completed`, pay-later invoices `paid`, `open` or `overdue` for charges (with the date in `note`) and `credited` for refunds. `created_by` says which agent or person triggered it. `return_id` links a refund to a return where known.

**disputes**: PayPal disputes and card chargebacks. `fee_eur` is the fee charged when a dispute is lost or accepted.

**kade_stock**: every returned pair on Kade's shelves, including pairs from before the data window. `status` is `available` (for resale), `sold`, `to_ortensi` (waiting to go back for credit), `held_for_claim` or `written_off`.

**supplier_invoices** and **supplier_invoice_lines**: both suppliers' weekly invoices, excluding VAT. `expected_total_eur` is what Paolo calculated from our cost prices (Ortensi only). Ciabatta's lines are extracted from its PDFs by the accounting tool; Paolo's rules don't cover them, so they wait for a human.

**conversations**: every customer conversation. `topic` is Mia's classification. `handled_by` is `mia` (Mia drafted, a human approved) or `sam` (Sam handled it directly).

**customer_messages**: everything customers said or were sent, in one place. Conversation messages have a `conversation_id` and full text (open conversations only). Tina's order emails for the last 14 days have a `template` and the `trigger_event_id` of the carrier scan that sent them, but no text.

**agent_actions**: every action an agent has proposed, with the human decision. `status` is `pending`, `approved`, `edited` or `rejected`. `args` is JSON. `review_today = 1` marks actions Mia flagged as urgent on Monday morning. `execution_result` records what happened when an approved action ran.

**agent_runs**: one row per agent run, with the model, tokens, cost and outcome.

**integrations**: every system connection, its schedule, owner and health.
