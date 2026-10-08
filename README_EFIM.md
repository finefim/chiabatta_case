# Ciabatta Club case: Efim's version

This is the original case folder plus my work. Nothing original was removed. Below: what to read, how to run it, and which files are new.

## Read in this order

1. `answers/ONE_PAGER.md`: findings, proposals ranked by money, fix / kill / teach. One page.
2. `answers/ANSWERS.md`: the full answers, following Sam's three questions.
3. `answers/GLOSSARY.md`: every business and technical word in plain English, with examples.

## See it running

You need Node.js 18 or newer (nodejs.org, "LTS"). Nothing else to install.

- On a Mac: double-click `start.command`. It stops any old copy of the server, starts this one and opens the browser.
- Anywhere else:

```bash
node api/server.mjs
```

Then open http://localhost:8787/admin/#/approach. The four new tabs at the top (start with **Approach**):

| Tab | What you'll see |
|---|---|
| **Approach** | Start here. The one number I steer by (profit per kept pair, after ads), my three levers (operations, supplier contracts, agent setup), what I found, proposals ranked by money, fix / kill / teach, and links to the other tabs. |
| **Impact** | The shop today vs. with my changes. Switch changes on and off and edit the yellow numbers; every figure follows. Below: 30 days of real history. |
| **Plan** | My first two weeks: a timeline, each day's tasks with "done when", and the targets for day 14 next to today's live numbers. |
| **Handoffs** | 16 questions between agents and suppliers that waited days with no owner, and when a person would have seen each one with the journal. |

## Check the numbers yourself

Python 3.9+, no packages:

```bash
python3 build/kade_router.py plan       # today's Kade-first plan
python3 build/kade_router.py selftest   # 11 checks, expect ALL PASS
python3 build/kept_pair.py              # profit per kept pair, today and per change
python3 build/handoffs.py               # the handoffs test on last month's messages
```

## What's new compared with the original case

| Path | What |
|---|---|
| `README_EFIM.md` | This file |
| `start.command` | One-click start on a Mac |
| `answers/ONE_PAGER.md`, `ANSWERS.md`, `GLOSSARY.md`, `teach_fix_kill.csv` | My answers |
| `build/*.py`, `build/README.md`, `build/economics_snapshot.json` | The code behind the answers |
| `site/admin/admin-approach.*`, `admin-impact.*`, `admin-plan.*`, `admin-handoffs.*`, `admin-glossary.js` | The four new back office tabs and their word list |
| `site/admin/impact-data.json`, `handoffs-data.json` | Data for those tabs, built by the scripts above |
| `site/admin/admin.js`, `site/admin/index.html` | Changed only to add the four tabs to the menu |

Everything is invented case data. Nothing is sent anywhere real.
