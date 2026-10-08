#!/usr/bin/env python3
"""
Kade-first router for Ciabatta Club.

Problem: returned grade-A pairs pile up at Kade (we already own them) while new
orders for the same SKU are bought again from the maker. Sam matched them by hand
on Fridays (~80 min a run) and stopped on 14 May. This replaces that run.

Code decides everything here; no model is involved. A model (Leo) only sends
the messages this script writes, and Mia only tells the customer the new tracking.

Usage (Python 3.9+, standard library only):
  python3 build/kade_router.py plan       # today's plan, written to build/out/
  python3 build/kade_router.py backtest   # replay the last 30 days: what we left on the table
  python3 build/kade_router.py selftest   # invariants on the plan (the "test")
  python3 build/kade_router.py plan --now 2026-06-15T11:30:00Z   # change an input: after Ciabatta's cut-off
  python3 build/kade_router.py plan --apply --base https://ciabatta.droppe.com   # send via the mock APIs
                                            (needs CASE_LOGIN and CASE_PASSWORD in the environment)
"""
import argparse, csv, json, os, sqlite3, sys, base64, urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, '..', 'data', 'ciabatta.db')
OUT = os.path.join(HERE, 'out')

# ---------------- inputs you can change on the call ----------------
CFG = dict(
    now='2026-06-15T06:30:00Z',          # frozen case clock (UTC)
    ortensi_batch_utc=12,                 # Ortensi starts its daily batch at 12:00 UTC
    ciabatta_keyin_utc=11,                # Ciabatta keys in email orders at 13:00 Italy = 11:00 UTC
    ortensi_uplift_from='2026-06-01',     # +8% on everything Ortensi ships from 1 June
    ortensi_uplift=0.08,
    ortensi_parcel=7.90, ciabatta_parcel=6.50,
    ortensi_credit_days=60,               # Ortensi credits unsold returns within 60 days of Kade's scan
    pallet_fee=0.90,                      # Kade return pallet to Ortensi, per pair
    pallet_warn_days=45,                  # put pairs this old on the pallet if nobody needs them
    min_saving=1.00,                      # only reroute if we save at least this much per order
)
# Kade resale order fees (systems.md)
KADE_PER_ORDER = 0.30 + 0.95 + 0.80 + 4.40   # processing, packing, box, DHL delivery
KADE_PER_PAIR = 0.30                          # pick

# A supplier order can be stopped safely only in these states (policies.md, systems.md, tasks T-1024.. T-1149)
SAFE_TO_STOP = {
    'Ortensi': {'RICEVUTO', 'SOSPESO'},          # API cancel works; IN_LAVORAZIONE returns 409
    'Ciabatta': {'EMAILED', 'OUT_OF_STOCK'},     # not keyed in yet / held by them; CONFIRMED = too late
}


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def supplier_of(sku):
    return 'Ciabatta' if sku.split('-')[0] in ('ULT', 'LOF', 'SOX') else 'Ortensi'


def load(con):
    con.row_factory = sqlite3.Row
    q = lambda s, *a: [dict(r) for r in con.execute(s, a)]
    d = {}
    d['products'] = {r['sku']: r for r in q('select * from products')}
    d['orders'] = {r['order_id']: r for r in q('select * from orders')}
    d['lines'] = defaultdict(list)
    for r in q('select * from order_lines order by order_id, line_no'):
        d['lines'][r['order_id']].append(r)
    d['so'] = {r['order_id']: r for r in q('select * from supplier_orders')}
    d['units'] = q('select * from kade_stock')
    d['open_conv'] = {r['order_id'] for r in q("select order_id from conversations where status='open' and order_id is not null")}
    d['pending_act'] = {r['order_id'] for r in q("select order_id from agent_actions where status='pending' and order_id is not null")}
    return d


def new_pair_cost(sku, products, ship_date):
    p = products[sku]['wholesale_price_eur']
    if supplier_of(sku) == 'Ortensi' and ship_date >= CFG['ortensi_uplift_from']:
        p *= 1 + CFG['ortensi_uplift']
    return p


def credit_value(unit, products, now):
    """What the pair is worth if we DON'T resell it: Ortensi credit inside the window, else nothing."""
    if supplier_of(unit['sku']) != 'Ortensi':
        return 0.0, None  # Ciabatta takes nothing back
    deadline = ts(unit['received_at']) + timedelta(days=CFG['ortensi_credit_days'])
    if now > deadline - timedelta(days=3):     # pallet needs a few days to reach Porto Sant'Elpidio
        return 0.0, deadline
    return products[unit['sku']]['wholesale_price_eur'] - CFG['pallet_fee'], deadline


def economics(order_lines, units, products, now):
    sup = supplier_of(order_lines[0]['sku'])
    ship_date = now.date().isoformat()
    buy_new = sum(new_pair_cost(l['sku'], products, ship_date) * l['qty'] for l in order_lines)
    buy_new += CFG['ortensi_parcel'] if sup == 'Ortensi' else CFG['ciabatta_parcel']
    pairs = sum(l['qty'] for l in order_lines)
    kade = KADE_PER_ORDER + KADE_PER_PAIR * pairs
    give_up = sum(credit_value(u, products, now)[0] for u in units)
    return round(buy_new - kade - give_up, 2), round(buy_new, 2), round(kade, 2), round(give_up, 2)


def cutoff_ok(sup, now):
    h = now.hour + now.minute / 60
    return h < (CFG['ortensi_batch_utc'] if sup == 'Ortensi' else CFG['ciabatta_keyin_utc'])


def pool_at(units, t, consumed):
    """Grade-A pairs physically on Kade's shelf at time t (oldest first)."""
    pool = defaultdict(list)
    for u in units:
        if u['grade'] != 'A' or u['unit_id'] in consumed:
            continue
        if ts(u['received_at']) > t:
            continue
        if u['status'] != 'available' and u['status_at'] and ts(u['status_at']) <= t:
            continue  # already sold / sent back / written off by then
        pool[u['sku']].append(u)
    for k in pool:
        pool[k].sort(key=lambda u: u['received_at'])
    return pool


def match_order(oid, d, pool):
    """Return (units, partial_lines) if every pair of the order is on the shelf, else (None, matched_lines)."""
    need = defaultdict(int)
    for l in d['lines'][oid]:
        need[l['sku']] += l['qty']
    take, matched = [], []
    for sku, n in need.items():
        have = pool.get(sku, [])
        if len(have) >= n:
            take += have[:n]
            matched.append(sku)
        elif have:
            matched.append(sku)
    full = len(matched) == len(need) and len(take) == sum(need.values())
    return (take if full else None), matched


# ---------------- plan ----------------
def plan(d, now):
    consumed, reroute, human, skipped = set(), [], [], defaultdict(int)
    pool = pool_at([u for u in d['units'] if u['status'] == 'available'], now, consumed)
    open_orders = sorted((o for o in d['orders'].values() if o['status'] == 'awaiting_supplier'),
                         key=lambda o: o['created_at'])
    # Orders waiting on out-of-stock come first: those customers are waiting anyway.
    open_orders.sort(key=lambda o: d['so'][o['order_id']]['status'] not in ('SOSPESO', 'OUT_OF_STOCK'))
    for o in open_orders:
        oid, so = o['order_id'], d['so'][o['order_id']]
        sup = so['supplier']
        units, matched = match_order(oid, d, pool)
        if not matched:
            continue
        reason = None
        if so['status'] not in SAFE_TO_STOP[sup]:
            reason = f'{sup} status {so["status"]}: too late to stop'
        elif not cutoff_ok(sup, now):
            reason = f'past {sup} cut-off today'
        elif oid in d['pending_act'] or oid in d['open_conv']:
            reason = 'customer has an open conversation / pending action (cancel, address...)'
        if reason and units:
            skipped[reason.split(':')[0]] += 1
            continue
        if units is None:
            # only part of the order is at Kade: a split costs a second parcel; worth it only if the
            # customer is waiting on an out-of-stock item. A human decides (and says it to the customer).
            if so['status'] in ('SOSPESO', 'OUT_OF_STOCK') and not reason:
                human.append(dict(order_id=oid, supplier_order_id=so['supplier_order_id'], supplier=sup,
                                  status=so['status'], skus_at_kade=' '.join(matched),
                                  why='split: ship the held item(s) from Kade now, rest from supplier'))
            continue
        saving, buy_new, kade_fee, give_up = economics(d['lines'][oid], units, d['products'], now)
        if saving < CFG['min_saving']:
            skipped['saving below threshold'] += 1
            continue
        for u in units:
            consumed.add(u['unit_id'])
            pool[u['sku']].remove(u)
        reroute.append(dict(order_id=oid, supplier=sup, supplier_order_id=so['supplier_order_id'],
                            supplier_status=so['status'], customer=o['ship_name'], country=o['ship_country'],
                            units=' '.join(u['unit_id'] for u in units), bins=' '.join(u['bin'] or '' for u in units),
                            skus=' '.join(u['sku'] for u in units), buy_new_eur=buy_new, kade_fee_eur=kade_fee,
                            credit_given_up_eur=give_up, saving_eur=saving,
                            address=f"{o['ship_name']}, {o['ship_street']}{', '+o['ship_line2'] if o['ship_line2'] else ''}, "
                                    f"{o['ship_postcode']} {o['ship_city']}, {o['ship_country']}"))
    # What's left on the shelf: Ortensi pairs to send back before the 60-day clock runs out
    pallet, dead = [], []
    for u in d['units']:
        if u['status'] != 'available' or u['unit_id'] in consumed or supplier_of(u['sku']) != 'Ortensi':
            continue
        age = (now - ts(u['received_at'])).days
        val, deadline = credit_value(u, d['products'], now)
        row = dict(unit_id=u['unit_id'], sku=u['sku'], bin=u['bin'], received_at=u['received_at'][:10],
                   age_days=age, credit_deadline=deadline.date().isoformat(), credit_eur=round(val, 2))
        if val == 0:
            dead.append(row)
        elif age >= CFG['pallet_warn_days']:
            pallet.append(row)
    return reroute, human, pallet, dead, skipped


def write_csv(name, rows):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, 'w', newline='') as f:
        if rows:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader(); w.writerows(rows)
    return path


def messages(reroute, pallet):
    """The messages Leo would send. Ortensi cancels go through the API; the rest are emails."""
    msgs = []
    for r in reroute:
        if r['supplier'] == 'Ortensi':
            msgs.append(dict(kind='api', method='POST', path=f"/ortensi/ordini/{r['supplier_order_id']}/annulla",
                             body={}, note=f"{r['order_id']} ships from Kade"))
    cb = [r for r in reroute if r['supplier'] == 'Ciabatta']
    if cb:
        msgs.append(dict(kind='mail', to='orders@ciabatta.example',
                         subject=f'Please cancel {len(cb)} emailed orders (not yet keyed in)',
                         body='Hello,\n\nplease do not key in these orders, we will fulfil them ourselves:\n' +
                              '\n'.join(f"- {r['supplier_order_id']} (our ref {r['order_id']})" for r in cb) +
                              '\n\nThank you,\nCiabatta Club'))
    if reroute:
        msgs.append(dict(kind='mail', to='clients@kadereturns.example',
                         subject=f'Resale pick list: {len(reroute)} orders', body='Hello,\n\nplease ship these resale orders (DHL):\n' +
                         '\n'.join(f"- {r['order_id']}: {r['units']} (bins {r['bins']}) to {r['address']}" for r in reroute) +
                         '\n\nPlease send the DHL numbers back so we can update the shop.\n\nCiabatta Club'))
    if pallet:
        msgs.append(dict(kind='mail', to='clients@kadereturns.example',
                         subject=f'Return pallet to Ortensi: {len(pallet)} pairs',
                         body='Hello,\n\nplease prepare a return pallet to Porto Sant\'Elpidio (EUR 0.90/pair) with:\n' +
                              '\n'.join(f"- {p['unit_id']} {p['sku']} (bin {p['bin']}, credit deadline {p['credit_deadline']})" for p in pallet) +
                              '\n\nCiabatta Club'))
    return msgs


def apply(msgs, base):
    auth = base64.b64encode(f"{os.environ['CASE_LOGIN']}:{os.environ['CASE_PASSWORD']}".encode()).decode()
    for m in msgs:
        if m['kind'] == 'api':
            url, body = base + m['path'], m['body']
        else:
            url, body = base + '/mail/send', {k: m[k] for k in ('to', 'subject', 'body')}
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
                                     headers={'Content-Type': 'application/json', 'Authorization': 'Basic ' + auth})
        try:
            with urllib.request.urlopen(req) as r:
                print('  ', r.status, url, r.read()[:120].decode())
        except urllib.error.HTTPError as e:
            print('  ', e.code, url, e.read()[:160].decode(), '-> leave for a human (email ordini@)')


def cmd_plan(d, now, args):
    reroute, human, pallet, dead, skipped = plan(d, now)
    msgs = messages(reroute, pallet)
    write_csv('reroute_to_kade.csv', reroute)
    write_csv('needs_human.csv', human)
    write_csv('pallet_to_ortensi.csv', pallet)
    write_csv('ortensi_credit_lost.csv', dead)
    with open(os.path.join(OUT, 'messages.json'), 'w') as f:
        json.dump(msgs, f, indent=2, ensure_ascii=False)
    by = defaultdict(lambda: [0, 0, 0.0])
    for r in reroute:
        by[r['supplier']][0] += 1; by[r['supplier']][1] += len(r['units'].split()); by[r['supplier']][2] += r['saving_eur']
    print(f"Kade-first plan at {now:%Y-%m-%d %H:%M} UTC")
    print(f"  grade-A pairs on Kade's shelf: {sum(1 for u in d['units'] if u['status']=='available' and u['grade']=='A')}")
    for s, (n, p, e) in sorted(by.items()):
        print(f"  reroute {n:3d} {s} orders ({p} pairs) -> save EUR {e:,.0f}")
    print(f"  total saving today: EUR {sum(r['saving_eur'] for r in reroute):,.0f}")
    print(f"  needs a human (split orders waiting on out-of-stock): {len(human)}")
    print(f"  not rerouted although Kade has the pairs: {dict(skipped)}")
    print(f"  pallet to Ortensi now (>= {CFG['pallet_warn_days']} days, credit EUR {sum(p['credit_eur'] for p in pallet):,.0f}): {len(pallet)} pairs")
    print(f"  Ortensi credit already lost (past 60 days, cost EUR {sum(d['products'][x['sku']]['wholesale_price_eur'] for x in dead):,.0f}): {len(dead)} pairs -> resell first")
    print(f"  messages for Leo: {len(msgs)} -> build/out/messages.json; CSVs in build/out/")
    if args.apply:
        print('Applying through', args.base); apply(msgs, args.base.rstrip('/'))
    return reroute, human, pallet, dead


# ---------------- backtest ----------------
def cmd_backtest(d, now):
    """Replay every order in the 30-day window as it arrived: was the whole order on Kade's shelf, and
    could the supplier order still be stopped (i.e. we route before submitting)? With a router in the
    order flow, we'd decide before the order goes to the maker, so status/cut-off checks don't apply."""
    consumed, hits, saving, sup_hits = set(), [], 0.0, defaultdict(lambda: [0, 0.0])
    real_units = d['units']
    for o in sorted(d['orders'].values(), key=lambda o: o['created_at']):
        t = ts(o['created_at'])
        if o['status'] == 'cancelled':
            continue
        pool = pool_at(real_units, t, consumed)
        units, _ = match_order(o['order_id'], d, pool)
        if not units:
            continue
        s, *_ = economics(d['lines'][o['order_id']], units, d['products'], t)
        if s < CFG['min_saving']:
            continue
        consumed.update(u['unit_id'] for u in units)
        hits.append(o['order_id']); saving += s
        sup = supplier_of(units[0]['sku']); sup_hits[sup][0] += 1; sup_hits[sup][1] += s
    sold_in_window = sum(1 for u in real_units if u['status'] == 'sold' and u['status_at'] and ts(u['status_at']) > now - timedelta(days=30))
    print('Backtest: last 30 days, router deciding each order as it arrives')
    print(f"  orders that could have shipped from Kade: {len(hits)} of {len(d['orders'])}")
    for s, (n, e) in sorted(sup_hits.items()):
        print(f"    {s}: {n} orders, EUR {e:,.0f}")
    print(f"  saving: EUR {saving:,.0f} in 30 days (~EUR {saving*12:,.0f} a year at this volume)")
    print(f"  what actually happened: {sold_in_window} pairs resold in the same 30 days (Sam's manual runs, stopped 14 May)")
    return hits, saving


# ---------------- selftest ----------------
def cmd_selftest(d, now):
    ok = True
    def check(name, cond, detail=''):
        nonlocal ok
        print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))
        ok &= bool(cond)
    reroute, human, pallet, dead, _ = plan(d, now)
    units = [u for r in reroute for u in r['units'].split()]
    avail = {u['unit_id']: u for u in d['units'] if u['status'] == 'available' and u['grade'] == 'A'}
    check('no Kade pair is promised twice', len(units) == len(set(units)))
    check('every pair used is grade A and on the shelf now', all(u in avail for u in units))
    check('every pair matches the SKU ordered',
          all(sorted(r['skus'].split()) == sorted(l['sku'] for l in d['lines'][r['order_id']] for _ in range(l['qty'])) for r in reroute))
    check('only supplier orders that can still be stopped',
          all(r['supplier_status'] in SAFE_TO_STOP[r['supplier']] for r in reroute))
    check('never touches an order with an open conversation or pending action',
          not any(r['order_id'] in d['pending_act'] or r['order_id'] in d['open_conv'] for r in reroute))
    check('every reroute saves money', all(r['saving_eur'] >= CFG['min_saving'] for r in reroute))
    check('pallet pairs are still inside the credit window',
          all(p['credit_deadline'] > now.date().isoformat() for p in pallet))
    check('no pallet pair is also rerouted', not set(p['unit_id'] for p in pallet) & set(units))
    # cut-off: after 12:00 UTC nothing goes out
    late = ts('2026-06-15T12:30:00Z')
    r2, *_ = plan(d, late)
    check('after both cut-offs nothing is rerouted', len(r2) == 0, f'{len(r2)} rerouted')
    mid = ts('2026-06-15T11:30:00Z')
    r3, *_ = plan(d, mid)
    check('between 11:00 and 12:00 UTC only Ortensi orders move', all(r['supplier'] == 'Ortensi' for r in r3))
    # a known trap: CC-12273 has a pending cancellation -> must not be rerouted
    check('pending cancellation CC-12273 is left alone', 'CC-12273' not in {r['order_id'] for r in reroute})
    print('ALL PASS' if ok else 'SOME CHECKS FAILED')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['plan', 'backtest', 'selftest'])
    ap.add_argument('--now', default=CFG['now'])
    ap.add_argument('--min-saving', type=float, default=CFG['min_saving'])
    ap.add_argument('--credit-days', type=int, default=CFG['ortensi_credit_days'])
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--base', default='http://localhost:8787')
    args = ap.parse_args()
    CFG['min_saving'], CFG['ortensi_credit_days'] = args.min_saving, args.credit_days
    d = load(sqlite3.connect(DB))
    now = ts(args.now)
    if args.cmd == 'plan':
        cmd_plan(d, now, args)
    elif args.cmd == 'backtest':
        cmd_backtest(d, now)
    else:
        sys.exit(0 if cmd_selftest(d, now) else 1)


if __name__ == '__main__':
    main()
