# build/: the code behind the answers

Everything here is plain Python 3.9+ with no extra packages. It reads the case database (`../data/ciabatta.db`) and never changes it. Run commands from the case folder (one level up).

| File | What it does in one sentence | Run |
|---|---|---|
| `kade_router.py` | Decides which open orders can ship from returned "as new" stock at Kade instead of being bought new, and writes the messages to send. | `python3 build/kade_router.py plan` |
| `kept_pair.py` | Calculates profit per pair the customer keeps (CM3), today and with each change, using the same formula as the Supplies page. | `python3 build/kept_pair.py` |
| `make_impact_data.py` | Builds the 30-day history behind the back office Impact tab. | `python3 build/make_impact_data.py` |
| `handoffs.py` | Runs last month's inbox and agent chat through the handoffs journal and shows how long each question waited without an owner. | `python3 build/handoffs.py` |
| `economics_snapshot.json` | A saved copy of the shop's 30-day figures that `kept_pair.py` uses. | — |

## kade_router.py, step by step

```bash
python3 build/kade_router.py plan        # today's plan; files go to build/out/
python3 build/kade_router.py backtest    # test it on last month's orders
python3 build/kade_router.py selftest    # 11 automatic checks; "ALL PASS" expected
python3 build/kade_router.py plan --now 2026-06-15T11:30:00Z   # what changes after Ciabatta's 11:00 UTC cut-off
python3 build/kade_router.py plan --min-saving 10              # only reroute if we save at least €10
```

For each open order it asks three questions:

1. Is every pair of the order on Kade's shelf, "as new", same shoe and size?
2. Can the maker still cancel it? Ortensi before 12:00 UTC while "received" or "on hold"; Ciabatta before 11:00 UTC while not yet typed in.
3. Do we save money after Kade's fees and any Ortensi refund we give up?

All three yes → ship from Kade. What it writes to `build/out/`:

| File | Contents |
|---|---|
| `reroute_to_kade.csv` | Orders to ship from Kade, which pairs, which shelf, how much we save |
| `needs_human.csv` | Orders only partly at Kade: a person decides |
| `pallet_to_ortensi.csv` | Ortensi pairs to send back before their 60-day refund runs out |
| `ortensi_credit_lost.csv` | Ortensi pairs already past 60 days: sell these first |
| `messages.json` | The cancellations and emails an agent would send |

`--apply` sends those messages to the mock systems (start the server first: `node api/server.mjs`).

What it printed on Monday 06:30 UTC: 92 orders, 110 pairs, €3,302 saved; last month tested: €2,244; checks: ALL PASS.

## Back office tabs added

Start the server (`start.command`, or `node api/server.mjs`) and open http://localhost:8787/admin/.

| Tab | File | What it shows |
|---|---|---|
| Approach | `site/admin/admin-approach.js` | Start page: North Star, three levers, findings, proposals by money, fix / kill / teach |
| Impact | `site/admin/admin-impact.js` | Today vs. with the changes; switch changes on and off; 30 days of history |
| Plan | `site/admin/admin-plan.js` | Two weeks day by day, with targets for day 14 |
| Handoffs | `site/admin/admin-handoffs.js` | Questions that waited without an owner, and what the journal would change |

Every new tab has a "What the words on this page mean" box at the bottom (`site/admin/admin-glossary.js`).
