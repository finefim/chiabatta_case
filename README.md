# Ciabatta Club: AI Operations case

Thanks for taking a look! It isn't meant to take a big chunk of your time, and there are no slides to make. It's built to be done with an AI coding agent (Claude Code, Codex, Cursor or similar): open this folder in your terminal, point your agent at it, and keep the decisions yourself.

Everything here is made up: the Ciabatta brand, Ortensi, Kade, every customer and every message. Nothing you do is really sent anywhere.

## Start with Sam's note

It's **Monday 15 June 2026, 08:30** in Italy. Sam, who runs operations, is on holiday until the 22nd, and you're covering. Sam left you a note on how the business runs and what we'd like from you: `note-from-sam.md`. It's also the first thing you see in the back office.

There's more here than you'll get through, and choosing what to look at is part of the job. Spend most of your time on your top one. Rough is fine: stop once you've shown how you think, and tell us what you'd do next.

**Nothing to send beforehand.** Bring whatever you made to the 45-minute call: notes, a doc, a spreadsheet, a repo or a voice memo. The templates in `answers/` are there if you want them. Please no slides. We won't open anything before we meet.

**The call.** 45 minutes to go through your thinking together, run what you built, and change an input to see what happens. Book it from your invitation.

## Start

```bash
node api/server.mjs     # Node 18+, nothing to install
```

- Shop: http://localhost:8787
- Back office: **Operations** at the top right of the shop, or http://localhost:8787/admin/. No separate login. Sam's note is on the home page, every table is browsable, and each one copies as markdown or downloads as CSV. **Brief your agent** at the top copies a starter prompt that tells your agent where everything is.
- Data: `sqlite3 data/ciabatta.db ".tables"`

The back office, the APIs and the files are the same data; use whichever suits you and your agent. Break things freely; restart the server to reset.

If you were sent a link instead, the same shop, back office and APIs are there. Sign in with the login from your invitation; your agent can call the APIs with it too (`curl -u login:password https://…/actions?status=pending`). Your changes are only visible to you.

## What's in the box

```
note-from-sam.md  how the business runs, and what we'd like from you
agents/        how each agent is built today: prompt, context, tools
data/          ciabatta.db (SQLite), the same tables as CSV, schema.sql (also works in Postgres/Supabase)
docs/          policies, how the business and systems work, table and API reference
logs/          the agents' Slack-style channels and 72 hours of tool calls
inbox/         the shared ops mailbox, with attachments
site/          the shop and the back office (served by api/server.mjs)
api/           the server, including mock supplier, carrier, returns, payment and helpdesk APIs
answers/       optional answer templates
build/         a place for what you build
```

All times are UTC. Money is in euros, including VAT unless a column says otherwise. If something's unclear, make an assumption and write it down.
