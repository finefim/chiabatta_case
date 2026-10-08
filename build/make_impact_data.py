#!/usr/bin/env python3
"""
Builds site/admin/impact-data.json for the back office's Impact tab: 30 days of history
from data/ciabatta.db, plus the Kade-first backtest replayed day by day.

  python3 build/make_impact_data.py
"""
import json, os, sqlite3, sys
from collections import defaultdict
from datetime import timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kade_router as k  # noqa: E402

OUT = os.path.join(HERE, '..', 'site', 'admin', 'impact-data.json')
con = sqlite3.connect(k.DB)
d = k.load(con)
con.row_factory = sqlite3.Row
q = lambda s, *a: [dict(r) for r in con.execute(s, a)]
now = k.ts(k.CFG['now'])
start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0)
days = [(start + timedelta(days=i)).date().isoformat() for i in range(31)]
day = lambda s: s[:10] if s else None


def per_day(rows, key='d', val=None):
    m = defaultdict(float)
    for r in rows:
        if r[key] in days:
            m[r[key]] += r[val] if val else 1
    return [round(m[x], 2) for x in days]


# --- orders, returns, Kade scans
orders = per_day([{'d': day(o['created_at'])} for o in d['orders'].values()])
returns_req = per_day([{'d': day(r['requested_at'])} for r in q('select requested_at from returns')])
kade_scans = per_day([{'d': day(r['kade_received_at'])} for r in q('select kade_received_at from returns where kade_received_at is not null')])
unscanned = q("""select count(*) n from returns r where kade_received_at is null and exists(select 1 from tracking_events t
                 where t.tracking_number=r.label_tracking and t.direction='return' and t.status='DELIVERED')""")[0]['n']

# --- agent spend per agent per day
agents = ['tina', 'mia', 'leo', 'nora', 'paolo']
runs = q('select agent, started_at, cost_eur from agent_runs')
spend = {a: per_day([{'d': day(r['started_at']), 'v': r['cost_eur']} for r in runs if r['agent'] == a], val='v') for a in agents}
spend_task = {r['k']: round(r['c'], 2) for r in q("select agent||'.'||task k, sum(cost_eur) c from agent_runs group by 1")}

# --- approval queue: pending at the end of each day (oldest wait in hours)
acts = q('select created_at, decided_at from agent_actions')
queue, oldest = [], []
for x in days:
    t = k.ts(x + 'T23:59:59Z') if x != days[-1] else now
    pend = [a for a in acts if k.ts(a['created_at']) <= t and (not a['decided_at'] or k.ts(a['decided_at']) > t)]
    queue.append(len(pend))
    oldest.append(round(max([(t - k.ts(a['created_at'])).total_seconds() / 3600 for a in pend], default=0), 1))
decided_30d = sum(1 for a in acts if a['decided_at'] and k.ts(a['decided_at']) > now - timedelta(days=30))

# --- refunds: days from Kade scan to refund, by week of refund
ref = q("""select p.created_at pa, r.kade_received_at ka from payments p join returns r on r.return_id=p.return_id
           where p.kind='refund' and r.kade_received_at is not null""")
refund_lag = round(sum((k.ts(x['pa']) - k.ts(x['ka'])).total_seconds() for x in ref) / max(len(ref), 1) / 86400, 1)

# --- Kade-first backtest, day by day; grade-A shelf as is vs with the router
consumed, saving_day, pairs_day = set(), defaultdict(float), defaultdict(int)
for o in sorted(d['orders'].values(), key=lambda o: o['created_at']):
    if o['status'] == 'cancelled':
        continue
    t = k.ts(o['created_at'])
    units, _ = k.match_order(o['order_id'], d, k.pool_at(d['units'], t, consumed))
    if not units:
        continue
    s, *_ = k.economics(d['lines'][o['order_id']], units, d['products'], t)
    if s < k.CFG['min_saving']:
        continue
    consumed.update(u['unit_id'] for u in units)
    saving_day[day(o['created_at'])] += s
    pairs_day[day(o['created_at'])] += len(units)
shelf_asis, shelf_router, used_by = [], [], {}
# when did the router use each unit?
consumed2 = set()
for o in sorted(d['orders'].values(), key=lambda o: o['created_at']):
    if o['status'] == 'cancelled':
        continue
    t = k.ts(o['created_at'])
    units, _ = k.match_order(o['order_id'], d, k.pool_at(d['units'], t, consumed2))
    if units and k.economics(d['lines'][o['order_id']], units, d['products'], t)[0] >= k.CFG['min_saving']:
        for u in units:
            consumed2.add(u['unit_id']); used_by[u['unit_id']] = t
for x in days:
    t = k.ts(x + 'T23:59:59Z') if x != days[-1] else now
    on = k.pool_at(d['units'], t, set())
    n_asis = sum(len(v) for v in on.values())
    n_router = sum(1 for v in on.values() for u in v if not (u['unit_id'] in used_by and used_by[u['unit_id']] <= t))
    shelf_asis.append(n_asis); shelf_router.append(n_router)
actual_resold = per_day([{'d': day(u['status_at'])} for u in d['units'] if u['status'] == 'sold'])

# --- Ortensi credit lost: grade-A pairs that passed day 60 on the shelf
lost60 = [sum(1 for u in d['units'] if u['grade'] == 'A' and supplier == k.supplier_of(u['sku']) and u['status'] == 'available'
              and (now - k.ts(u['received_at'])).days > 60) for supplier in ['Ortensi']][0]

# --- disputes, reviews, Sam's time
disp = {r['status']: {'n': r['n'], 'eur': r['eur'], 'fee': r['fee'] or 0}
        for r in q('select status, count(*) n, sum(amount_eur) eur, sum(fee_eur) fee from disputes group by 1')}
rev = q('select substr(created_at,1,10) d, rating from reviews')
rev_week = defaultdict(list)
for r in rev:
    rev_week[r['d'][:8] + ('0' if int(r['d'][8:]) < 10 else '1' if int(r['d'][8:]) < 20 else '2')].append(r['rating'])
cats = {'address': 0, 'refund_status': 0, 'disputes': 0, 'late_cancel': 0, 'gls_redirect': 0, 'ortensi_call': 0, 'paylater': 0, 'other': 0}
for t in q("select title, handover_note h, outcome o, minutes_spent m from tasks where opened_at >= ?", start.isoformat()[:10]):
    h, o, m = t['h'] or '', t['o'] or '', t['m'] or 0
    c = ('address' if h.startswith('Address change approved') else 'refund_status' if h.startswith('Customer asks about a refund')
         else 'disputes' if 'Dispute' in h else 'late_cancel' if o.startswith('Already packed') else 'gls_redirect' if o.startswith('Redirected')
         else 'ortensi_call' if 'Chiara' in t['title'] else 'paylater' if o.startswith('Reminder sent') else 'other')
    cats[c] += m

data = dict(
    generated_from='data/ciabatta.db, snapshot 2026-06-15 06:30 UTC', days=days,
    orders=orders, returns_requested=returns_req, kade_scans=kade_scans, unscanned_at_kade=unscanned,
    agents=agents, spend=spend, spend_by_task=spend_task,
    queue=queue, queue_oldest_h=oldest, approvals_decided_30d=decided_30d, refund_lag_days=refund_lag,
    backtest=dict(saving=[round(saving_day[x], 2) for x in days], pairs=[pairs_day[x] for x in days],
                  actual_resold=actual_resold, total=round(sum(saving_day.values()), 2), orders=len(consumed)),
    shelf=dict(as_is=shelf_asis, router=shelf_router), ortensi_pairs_past_60=lost60,
    disputes=disp, reviews={kk: round(sum(v) / len(v), 2) for kk, v in sorted(rev_week.items())},
    reviews_avg=round(sum(r['rating'] for r in rev) / len(rev), 2), reviews_n=len(rev),
    sam_minutes=cats,
)
# today's Kade-first plan (same code as `kade_router.py plan`)
_rr, _hum, _pal, _dead, _ = k.plan(d, now)
data['today_plan'] = dict(orders=len(_rr), pairs=sum(len(r['units'].split()) for r in _rr), saving=round(sum(r['saving_eur'] for r in _rr), 2))
with open(OUT, 'w') as f:
    json.dump(data, f, indent=1)
print('wrote', os.path.relpath(OUT), '| backtest EUR', data['backtest']['total'], '| queue today', queue[-1],
      '| Sam min', sum(cats.values()), '| refund lag d', refund_lag, '| unscanned', unscanned)
