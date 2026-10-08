#!/usr/bin/env python3
"""
Handoff journal, replayed on the case history.

Today agents pass questions by shouting into #ops-agents and forget them. Here every
"someone else has to do something" becomes ONE row with an owner, a due time and a status:

  1. ROUTE  - code (the table below), not the agent, decides the topic and the owner.
  2. MERGE  - the same topic about the same thing while it's open = the same row (a counter goes up).
  3. WATCH  - a watchdog escalates any row past its due time to a human, with the evidence attached.

The replay reads the ops inbox and the agents' channel in time order and shows, for every
handoff, what actually happened vs. when a human would have had it with the journal.

  python3 build/handoffs.py            # prints the summary, writes site/admin/handoffs-data.json
"""
import json, os, re, sqlite3
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
NOW = datetime.fromisoformat('2026-06-15T06:30:00+00:00')
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))

# ---------------- routing table: topic -> owner, time to answer (hours), why ----------------
ROUTES = {
    'credentials':      ('human', 24, 'Passwords, keys and tokens need an admin. An agent may never skip them.'),
    'supplier_payment': ('human', 4,  'Overdue supplier invoices and credit holds stop a third of the shop.'),
    'commercial':       ('elena', 72, 'Prices, terms and partners are Elena’s.'),
    'held_orders':      ('human', 24, 'Wait, swap or cancel is a customer decision; Mia then asks each customer.'),
    'order_ops':        ('leo',   4,  'One supplier order, one owner, one message to the supplier.'),
    'customer_notice':  ('mia',   24, 'A supplier closure or delay customers must hear about.'),
    'dispute':          ('paolo', 0,  'Paolo prepares the evidence; due 48 h before the provider’s deadline; a human decides.'),
    'returns_stock':    ('human', 48, 'Pairs near Ortensi’s 60-day credit: pallet or resale.'),
    'returns_backlog':  ('human', 24, 'Kade scans late: send them the DHL numbers to prioritise (T-1010).'),
    'integration':      ('human', 72, 'A setup the supplier or carrier offers: someone decides and does it.'),
    'tracking_gap':     ('leo',   24, 'Orders without tracking: Leo names the cause or escalates.'),
    'approval_queue':   ('human', 4,  'Actions waiting for a human click.'),
}

# ---------------- classification rules (first match wins) ----------------
EMAIL_RULES = [
    (r'credit hold|overdue', 'supplier_payment', lambda m: 'ciabatta-invoices'),
    (r'sftp access|credenziali|credentials renewal|api token', 'credentials', lambda m: m['src']),
    (r'listino|price list', 'commercial', lambda m: 'ortensi-prices'),
    (r'annullarlo o spedirlo|cancel or ship|due email diverse', 'order_ops', lambda m: 'ORT-26-33678'),
    (r'portofino sabbia 38|in attesa', 'held_orders', lambda m: 'POR-SND-38'),
    (r'out of stock:|cancel those lines or wait', 'held_orders', lambda m: 'ciabatta-oos'),
    (r'esauriti', 'held_orders', lambda m: 'CAP-BLK-42-43'),
    (r'chiusura magazzino|warehouse will be closed', 'customer_notice', lambda m: 'ortensi-closure'),
    (r'opened a dispute|respond to dispute', 'dispute', lambda m: re.search(r'PP-D-\d+', m['subject'] + m['body']).group(0)),
    (r'older than 45 days', 'returns_stock', lambda m: 'kade-ageing'),
    (r'intake delays|running 5 to 8', 'returns_backlog', lambda m: 'kade-scans'),
    (r'move to sftp', 'integration', lambda m: 'ciabatta-sftp'),
    (r'webhooks', 'integration', lambda m: 'gls-webhooks'),
]
CHAN_RULES = [
    (r'^tina$', r'no tracking 24h\+', 'tracking_gap', lambda t: 'no-tracking'),
    (r'^paolo$', r'returns delivered to kade but not scanned', 'returns_backlog', lambda t: 'kade-scans'),
    (r'^mia$', r'@sam \d+ actions waiting', 'approval_queue', lambda t: 'queue'),
    (r'^leo$', r'portofino|por-snd-38', 'held_orders', lambda t: 'POR-SND-38'),
    (r'^(leo|paolo)$', r'ort-26-33678', 'order_ops', lambda t: 'ORT-26-33678'),
]
SKIP_EMAIL = r'^fattura|^invoice kr-|closed in your favour|tiktok|welcome to ciabatta'

# ---------------- what actually happened (from tasks, logs and data) ----------------
AS_IS = {
    'credentials:mail_0002':   ('Leo: “Credentials. Requires admin access, skipped.” Never set up.', 'Still 1 email per order to Ciabatta, processed once a day; 7 late Ciabatta cancels.'),
    'commercial:ortensi-prices': ('Leo: “Filed, no action needed.” Elena never asked.', '+8% paid with 12 days’ notice instead of 30: €3,528 so far, auto-approved by Paolo.'),
    'integration:ciabatta-sftp': ('Handed to Sam as T-1050; Sam on holiday; unassigned.', '650 email orders a month; Ciabatta processes them once a day.'),
    'customer_notice:ortensi-closure': ('Labelled “newsletter”. Customers not told.', 'Where-is-my-order chats up 2.1× (Nora, 12 June); Sam’s Easter notice had cut them.'),
    'held_orders:POR-SND-38':  ('Leo → Nora: “Noted, will include in digest.” T-1082 unassigned.', '4 orders held by Ortensi since 4 June; customers not told.'),
    'supplier_payment:ciabatta-invoices': ('Paolo: “Waiting for Sam.” T-1150 unassigned.', 'Credit hold on 16 June: Ciabatta stops shipping a third of our pairs.'),
    'returns_stock:kade-ageing': ('Paolo: “Noted.” T-1092 unassigned.', '46 pairs older than 45 days; 24 Ortensi pairs already past the 60-day credit.'),
    'returns_backlog:kade-scans': ('Paolo posts the same count every morning; T-1106 unassigned.', '31 “where’s my refund?” tasks for Sam (217 min); refunds wait 5–8 days.'),
    'dispute:PP-D-22918461':   ('Paolo proposes to ACCEPT (under €150) though GLS shows delivered; waits in the queue.', '€139 + €15 fee lost if accepted; deadline 19 June.'),
    'credentials:mail_0016':   ('Leo: “Credential notice. Requires admin access, skipped.” T-1119 unassigned.', 'Stock feed dead since 12 June (37 failures); the shop sells sizes that are gone.'),
    'integration:gls-webhooks': ('Labelled “newsletter”.', 'Tina keeps polling every 15 min: €575 a month.'),
    'held_orders:ciabatta-oos': ('Leo: “Stock info noted.” T-1132 unassigned.', '17 orders held by Ciabatta; shop still shows the sizes in stock.'),
    'held_orders:CAP-BLK-42-43': ('Leo: “Stock info noted.” T-1136 unassigned.', 'Orders SOSPESO at Ortensi; the shop keeps selling Capri Nero 42/43.'),
    'order_ops:ORT-26-33678':  ('Leo asks to cancel, Paolo asks for a ship date; Leo → Paolo → Leo: “Noted.” T-1151 unassigned.', 'Ortensi ships its backlog today; the customer was already refunded €89.'),
    'tracking_gap:no-tracking': ('Tina asks Leo every 4 h; Leo: “I’ll check again next cycle.” Cause never named.', 'Gap grew from 50 to 345 orders; the cause (Ortensi closed 11–12 June) was in mail_0008.'),
    'approval_queue:queue':    ('Mia posts “@sam N actions waiting” to someone on holiday.', '194 actions waiting, the oldest 63 h.'),
}


def load_events():
    ev = []
    for l in open(os.path.join(ROOT, 'inbox', 'ops_inbox.jsonl')):
        m = json.loads(l)
        if m.get('direction') == 'sent':
            ev.append(dict(at=m['received_at'], kind='sent', src=m['id'], who='leo' if 'Leo' in m['from'] else 'paolo',
                           text=m['subject'] + ' ' + m['body']))
            continue
        ev.append(dict(at=m['received_at'], kind='email', src=m['id'], who=m['from'].split('<')[0].strip(),
                       subject=m['subject'], body=m['body'], text=m['subject'] + ' ' + m['body']))
    for l in open(os.path.join(ROOT, 'logs', 'agent_channel.jsonl')):
        c = json.loads(l)
        ev.append(dict(at=c['ts'], kind='chat', src=f"{c['channel']} {c['ts'][5:16]}", who=c['user'], text=c['text']))
    return sorted(ev, key=lambda e: e['at'])


def classify(e):
    t = e['text'].lower()
    if e['kind'] == 'email':
        if re.search(SKIP_EMAIL, t):
            return None
        for pat, topic, key in EMAIL_RULES:
            if re.search(pat, t):
                return topic, key(e)
    if e['kind'] in ('chat', 'sent'):
        for who, pat, topic, key in CHAN_RULES:
            if re.search(who, e['who']) and re.search(pat, t):
                return topic, key(e)
    return None


def replay():
    rows, noise = {}, {'digest': 0, 'chat': 0}
    for e in load_events():
        c = classify(e)
        if not c:
            if e['kind'] == 'chat':
                noise['digest' if e['who'] == 'nora' else 'chat'] += 1
            continue
        topic, about = c
        key = f'{topic}:{about}'
        owner, sla, why = ROUTES[topic]
        if key not in rows:
            created = ts(e['at'])
            due = created + timedelta(hours=sla)
            if topic == 'dispute':
                due = ts('2026-06-19T23:59:00Z') - timedelta(hours=48)
            rows[key] = dict(key=key, topic=topic, about=about, owner=owner, sla_h=sla, why=why,
                             created=e['at'], due=due.isoformat().replace('+00:00', 'Z'), events=[])
        rows[key]['events'].append(dict(at=e['at'], kind=e['kind'], src=e['src'], who=e['who'],
                                        text=(e.get('subject') or e['text'])[:140]))
    out = []
    for r in rows.values():
        created, due = ts(r['created']), ts(r['due'])
        to_human = created if r['owner'] in ('human', 'elena') else due  # agents get until the due time, then it escalates
        happened, cost = AS_IS.get(r['key'], ('', ''))
        r.update(repeats=len(r['events']), as_is=happened, consequence=cost,
                 open_h=round((NOW - created).total_seconds() / 3600, 1),
                 to_human_h=round(max(0, (to_human - created).total_seconds()) / 3600, 1),
                 human_by=to_human.isoformat().replace('+00:00', 'Z'), overdue_now=NOW > due)
        out.append(r)
    out.sort(key=lambda r: r['created'])
    return out, noise


if __name__ == '__main__':
    rows, noise = replay()
    msgs = sum(r['repeats'] for r in rows)
    data = dict(snapshot=NOW.isoformat().replace('+00:00', 'Z'), routes={k: dict(owner=v[0], sla_h=v[1], why=v[2]) for k, v in ROUTES.items()},
                handoffs=rows, messages=msgs, noise=noise,
                summary=dict(handoffs=len(rows), messages=msgs, open_now=sum(1 for r in rows if r['as_is']),
                             median_open_days=sorted(r['open_h'] for r in rows)[len(rows) // 2] / 24,
                             max_to_human_h=max(r['to_human_h'] for r in rows)))
    with open(os.path.join(ROOT, 'site', 'admin', 'handoffs-data.json'), 'w') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print(f'{len(rows)} handoffs from {msgs} emails and chat messages ({noise["digest"]} Nora digests and {noise["chat"]} other posts are not handoffs)')
    for r in rows:
        print(f"  {r['created'][:16]}  {r['topic']:17} {r['about']:20} owner {r['owner']:6} x{r['repeats']:<3} "
              f"open {r['open_h'] / 24:5.1f} d  ->  human within {r['to_human_h']:4.0f} h")
    print('missing as-is text:', [r['key'] for r in rows if not r['as_is']])
