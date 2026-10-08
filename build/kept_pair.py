#!/usr/bin/env python3
"""
What one kept pair leaves us (CM3 per kept pair), today and lever by lever.

Same model as the back office's Supplies page (site/admin/admin-economics.js), ported line by line,
with the same 30-day defaults (build/economics_snapshot.json = GET /admin/economics on 15 June).

  CM1 = net price - cost price - first delivery                  (left for operations)
  CM2 = CM1 - returns, write-offs, payments, disputes, agents, Sam (after operations)
  CM3 = CM2 - paid ads net of co-marketing                        (what one kept pair leaves us)

"Per kept pair": ~26% of pairs come back, so each kept pair also carries the cost of
r/(1-r) returned pairs (0.35 for the shop, 0.78 for the Loafer).

  python3 build/kept_pair.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'economics_snapshot.json')))


def model(v):
    p = lambda k: v[k] / 100
    r = p('return_rate'); shipped = 1 / (1 - r); returned = r / (1 - r)
    net = v['price_incl'] / (1 + p('vat'))
    cogs = v['cost'] * (1 + p('rise')) * (1 - p('cash_discount'))
    dpp = v['dropship'] / v['pairs_per_order']
    kept = v['orders_month'] * v['pairs_per_order'] * (1 - r)
    uncredited = cogs * (1 - p('credit')); back = uncredited + v['pallet'] * p('credit')
    unsold_a = p('a_expired') * cogs + (1 - p('a_expired')) * back
    stock = returned * (p('grade_c') * cogs + p('grade_b') * back + p('grade_a') * (1 - p('a_resold')) * unsold_a)
    resale = returned * p('grade_a') * p('a_resold') * (dpp - v['resale_fee'])
    cm1 = net - cogs - dpp * shipped
    cm2 = (cm1 - returned * (v['label'] + v['receipt'] + v['storage'] * v['months']) - stock + resale
           - p('fee') * v['price_incl'] * shipped - p('invoice_share') * p('credit_loss') * v['price_incl']
           - p('dispute_rate') * (v['dispute_fee'] + p('dispute_lost') * v['price_incl'])
           - v['agents_month'] / kept - v['human_month'] / kept)
    cm3 = cm2 - (v['ads'] * v['orders_month'] - v['comarketing']) / kept
    return cm1, cm2, cm3, kept, returned


mix = d['payment_mix']; s = d['ortensi_pair_share']
SHARED = dict(vat=20, pairs_per_order=round(d['pairs_per_order'], 2), label=8.4, receipt=1.6, storage=0.4, months=1,
              a_resold=0, a_expired=40, resale_fee=6.75, pallet=0.9,
              fee=round(mix['card'] * 1.9 + mix['paypal'] * 2.9 + mix['invoice'] * 2.5, 2),
              invoice_share=round(mix['invoice'] * 100), credit_loss=round(d['credit_loss_rate'] * 100, 1),
              dispute_rate=round(d['dispute_rate'] * 100, 2), dispute_fee=15, dispute_lost=50, orders_month=d['orders'],
              agents_month=round(d['agent_cost_30d_eur']), human_month=4800, ads=18)


def product(x):
    o = x['supplier'] == 'Ortensi'
    return {**SHARED, 'price_incl': x['price_incl'], 'cost': x['cost'], 'rise': 8 if o else 0, 'dropship': 7.9 if o else 6.5,
            'return_rate': round(x['return_rate'] * 100, 1), 'grade_a': round(x['grade_shares']['A'] * 100),
            'grade_b': round(x['grade_shares']['B'] * 100), 'grade_c': round(x['grade_shares']['C'] * 100),
            'credit': 100 if o else 0, 'comarketing': 0, 'cash_discount': 0, '_ort': 1 if o else 0}


SHOP = {**SHARED, 'price_incl': round(d['avg_price_incl_vat'], 2),
        'cost': round(s * d['avg_cost_ortensi'] + (1 - s) * d['avg_cost_ciabatta'], 2), 'rise': round(8 * s, 1),
        'dropship': round(7.9 * s + 6.5 * (1 - s), 2), 'return_rate': round(d['return_rate'] * 100, 1),
        'grade_a': round(d['grade_shares']['A'] * 100), 'grade_b': round(d['grade_shares']['B'] * 100),
        'grade_c': round(d['grade_shares']['C'] * 100), 'credit': round(100 * s), 'comarketing': 0, 'cash_discount': 0, '_ort': s}

# My measures, as assumptions (change them here)
LEVERS = [
    ('Kade-first routing + pallet before day 60', dict(a_resold=70, a_expired=5)),
    ('Contest disputes with the carrier scan', dict(dispute_lost=10)),
    ('Agents: kill polling/digest/execute runs', dict(agents_month=600)),
    ('Take Ortensi 2% early-payment discount', 'cash'),
    # Not mine to decide (Elena):
    ('[Elena] Ciabatta credits unsold returns', 'cb_credit'),
    ('[Elena] Paid ads EUR 18 -> 12 per order', dict(ads=12)),
]


def apply(v, lever):
    if lever == 'cash':
        return {**v, 'cash_discount': 2 * v['_ort']}
    if lever == 'cb_credit':
        return {**v, 'credit': 100}
    return {**v, **lever}


if __name__ == '__main__':
    print('CM per kept pair, EUR (30-day defaults from the Supplies page)\n')
    print(f"{'':22}{'CM1':>8}{'CM2':>8}{'CM3':>8}{'my 4 levers':>13}")
    rows = [(x['name'], product(x)) for x in d['products']] + [('Whole shop', SHOP)]
    for name, v in rows:
        cm1, cm2, cm3, *_ = model(v)
        w = v
        for _, lv in LEVERS[:4]:
            w = apply(w, lv)
        print(f"{name[:22]:22}{cm1:8.2f}{cm2:8.2f}{cm3:8.2f}{model(w)[2]:13.2f}")
    cm1, cm2, cm3, kept, returned = model(SHOP)
    print(f"\nWhole shop: {kept:,.0f} kept pairs a month; each carries {returned:.2f} returned pairs.")
    print(f"Today: CM3 EUR {cm3:.2f} per kept pair = EUR {cm3 * kept:,.0f} a month.\n")
    print('Lever by lever (whole shop, cumulative):')
    v, prev = SHOP, cm3
    for name, lv in LEVERS:
        v = apply(v, lv)
        now = model(v)[2]
        print(f"  {name:42} CM3 {now:7.2f}  ({now - prev:+.2f})  = EUR {now * kept:9,.0f}/month")
        prev = now
