// Ciabatta Club back office, Supplies: supplier terms first, then what one kept pair leaves us.
// Defaults come from the last 30 days of data (/admin/economics); every input is editable.
(() => {
  const { views, api, esc, eur, head } = CC;

  const INPUTS = [
    ['Price & product', [['price_incl', 'Price per pair, incl. VAT', '€'], ['vat', 'VAT', '%'], ['cost', 'Cost price per pair (before any rise)', '€'], ['rise', 'Price rise from the maker', '%'], ['cash_discount', 'Cash discount taken for early payment', '%']]],
    ['Delivery & returns', [['pairs_per_order', 'Pairs per order', ''], ['dropship', 'Dropship per parcel', '€'], ['return_rate', 'Share of pairs returned', '%'],
      ['label', 'DHL return label per returned pair', '€'], ['receipt', 'Kade check and grading per pair', '€'], ['storage', 'Kade storage per pair per month', '€'], ['months', 'Months a pair sits at Kade', '']]],
    ['What happens to returned pairs', [['grade_a', 'Grade A (resellable)', '%'], ['grade_b', 'Grade B', '%'], ['grade_c', 'Grade C (write-off)', '%'],
      ['a_resold', 'Grade A resold from Kade', '%'], ['a_expired', 'Unsold grade A that misses the maker’s credit', '%'], ['credit', 'Maker credits unsold returns', '%'],
      ['resale_fee', 'Kade resale fulfilment per pair', '€'], ['pallet', 'Return pallet to the maker per pair', '€']]],
    ['Payments', [['fee', 'Blended payment fee', '%'], ['invoice_share', 'Orders paid later by invoice', '%'], ['credit_loss', 'Invoices never paid', '%'],
      ['dispute_rate', 'Disputes per order', '%'], ['dispute_fee', 'Dispute fee', '€'], ['dispute_lost', 'Disputes lost or accepted', '%']]],
    ['Team & growth', [['orders_month', 'Orders per month (whole shop)', ''], ['agents_month', 'Agent model spend per month', '€'], ['human_month', 'Operator cost per month', '€'],
      ['ads', 'Paid ads per order', '€'], ['comarketing', 'Maker co-marketing per month', '€']]],
  ];

  function model(v) {
    const p = k => v[k] / 100;
    const r = p('return_rate'), shipped = 1 / (1 - r), returned = r / (1 - r);
    const net = v.price_incl / (1 + p('vat'));
    const cogs = v.cost * (1 + p('rise')) * (1 - p('cash_discount'));
    const dropPerPair = v.dropship / v.pairs_per_order;
    const keptMonth = v.orders_month * v.pairs_per_order * (1 - r);
    // A returned pair costs nothing more if it's resold or credited back; it costs its full price if written off or never resold or credited.
    const uncredited = cogs * (1 - p('credit'));
    const backToMaker = uncredited + v.pallet * p('credit');
    const unsoldA = p('a_expired') * cogs + (1 - p('a_expired')) * backToMaker;
    const stock = returned * (p('grade_c') * cogs + p('grade_b') * backToMaker + p('grade_a') * (1 - p('a_resold')) * unsoldA);
    const resale = returned * p('grade_a') * p('a_resold') * (dropPerPair - v.resale_fee);
    const rows = [
      ['Net price', net, 'pos'],
      ['Cost price', -cogs],
      ['First delivery (dropship)', -dropPerPair * shipped],
      ['CM1 · left for operations', null, 'total'],
      ['Return label, check and storage', -returned * (v.label + v.receipt + v.storage * v.months)],
      ['Returned pairs: write-offs and lost credit', -stock],
      ['Resale fulfilment instead of a new dropship', resale, resale > 0 ? 'pos' : ''],
      ['Payment fees', -p('fee') * v.price_incl * shipped],
      ['Unpaid invoices', -p('invoice_share') * p('credit_loss') * v.price_incl],
      ['Disputes', -p('dispute_rate') * (v.dispute_fee + p('dispute_lost') * v.price_incl)],
      ['Agents', -v.agents_month / keptMonth],
      ['Operator', -v.human_month / keptMonth],
      ['CM2 · after operations', null, 'total'],
      ['Paid ads, net of co-marketing', -(v.ads * v.orders_month - v.comarketing) / keptMonth],
      ['CM3 · what one kept pair leaves us', null, 'total'],
    ];
    let running = 0;
    for (const row of rows) { if (row[1] == null) row[1] = running; else running += row[1]; }
    return { rows, keptMonth, returned };
  }

  views.supplies = async page => {
    const d = await api('/admin/economics');
    const mix = d.payment_mix;
    const shared = {
      vat: 20, pairs_per_order: +d.pairs_per_order.toFixed(2), label: 8.4, receipt: 1.6, storage: 0.4, months: 1, a_resold: 0, a_expired: 40, resale_fee: 6.75, pallet: 0.9,
      fee: +(mix.card * 1.9 + mix.paypal * 2.9 + mix.invoice * 2.5).toFixed(2), invoice_share: +(mix.invoice * 100).toFixed(0), credit_loss: +(d.credit_loss_rate * 100).toFixed(1),
      dispute_rate: +(d.dispute_rate * 100).toFixed(2), dispute_fee: 15, dispute_lost: 50, orders_month: d.orders, agents_month: Math.round(d.agent_cost_30d_eur), human_month: 4800, ads: 18,
    };
    const forProduct = x => ({
      ...shared, price_incl: x.price_incl, cost: x.cost, rise: x.supplier === 'Ortensi' ? 8 : 0, dropship: x.supplier === 'Ortensi' ? 7.9 : 6.5,
      return_rate: +(x.return_rate * 100).toFixed(1), grade_a: +(x.grade_shares.A * 100).toFixed(0), grade_b: +(x.grade_shares.B * 100).toFixed(0), grade_c: +(x.grade_shares.C * 100).toFixed(0),
      credit: x.supplier === 'Ortensi' ? 100 : 0, comarketing: 0, cash_discount: 0,
    });
    const shop = {
      ...shared, price_incl: +d.avg_price_incl_vat.toFixed(2), cost: +(d.ortensi_pair_share * d.avg_cost_ortensi + (1 - d.ortensi_pair_share) * d.avg_cost_ciabatta).toFixed(2),
      rise: +(8 * d.ortensi_pair_share).toFixed(1), dropship: +(7.9 * d.ortensi_pair_share + 6.5 * (1 - d.ortensi_pair_share)).toFixed(2), return_rate: +(d.return_rate * 100).toFixed(1),
      grade_a: +(d.grade_shares.A * 100).toFixed(0), grade_b: +(d.grade_shares.B * 100).toFixed(0), grade_c: +(d.grade_shares.C * 100).toFixed(0),
      credit: +(100 * d.ortensi_pair_share).toFixed(0), comarketing: 0, cash_discount: 0,
    };
    const best = d.products[0];
    const SCENARIOS = {
      today: { label: 'Reset to today', set: () => ({}) },
    };
    let sel = best.code, scen = 'today', v = {};

    page.innerHTML = head('Supplies', 'Supplier terms first, then what one kept pair leaves us today, starting with the bestseller. “Per kept pair” carries the cost of every pair shipped and returned on the way. Yellow cells are inputs; defaults come from the last 30 days of data.') + `
      <h2 class="sec-h">Supplier terms</h2>
      <div class="grid two terms">${d.terms.map(t => `<div class="card"><div class="terms__head"><b>${esc(t.supplier)}</b><span class="muted">${esc(t.who)}</span></div>
        ${t.sections.map(([h, rows]) => `<h3 class="terms__sec">${esc(h)}</h3><dl class="kv">${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('')}</dl>`).join('')}</div>`).join('')}</div>
      <h2 class="sec-h" id="ue-h"></h2>
      <div class="scen" id="prod"></div>
      <div class="econ">
        <div class="card inputs" id="inputs"></div>
        <div class="card"><div class="scen" id="scen"></div><div class="wf" id="wf"></div><p class="faint" id="foot"></p></div>
      </div>
      <h2 class="sec-h">How an order flows</h2>
      <div class="flow" id="flow"></div>`;

    const $ = s => page.querySelector(s);
    const drawInputs = () => {
      $('#inputs').innerHTML = INPUTS.map(([group, list]) => `<h3>${esc(group)}</h3>` + list.map(([k, l, u]) =>
        `<label class="in"><span>${esc(l)}${u ? ` <span class="faint">${u}</span>` : ''}</span><input type="number" step="any" data-k="${k}" value="${v[k]}"></label>`).join('')).join('');
    };
    const render = () => {
      const x = sel === 'shop' ? null : d.products.find(p => p.code === sel);
      $('#ue-h').textContent = x ? `Unit economics today: ${x.name}${x.code === best.code ? ' (bestseller)' : ''}` : 'Unit economics today: the whole shop';
      $('#prod').innerHTML = d.products.map(p => `<button class="chip ${p.code === sel ? 'on' : ''}" data-p="${p.code}">${esc(p.name)} <span class="faint">${p.pairs.toLocaleString('en')} pairs</span></button>`).join('') +
        `<button class="chip ${sel === 'shop' ? 'on' : ''}" data-p="shop">Whole shop</button>`;
      $('#scen').innerHTML = Object.entries(SCENARIOS).map(([k, s]) => `<button class="chip ${k === scen ? 'on' : ''}" data-s="${k}">${esc(s.label)}</button>`).join('');
      const { rows, keptMonth, returned } = model(v);
      const scale = Math.max(...rows.map(r => Math.abs(r[1])));
      $('#wf').innerHTML = rows.map(([label, val, kind]) => `
        <div class="r ${kind || ''} ${kind === 'total' && val < 0 ? 'neg-total' : ''}">
          <span>${esc(label)}</span><span class="mono" style="text-align:right">${eur(val)}</span>
          <span class="mono faint" style="text-align:right">${((val / rows[0][1]) * 100).toFixed(1)}%</span>
          <span><span class="bar" style="display:block;width:${Math.max(1, (Math.abs(val) / scale) * 100)}%"></span></span></div>`).join('');
      $('#foot').textContent = `${x ? `${x.name} is made by ${x.supplier}. ` : ''}${Math.round(keptMonth).toLocaleString('en')} kept pairs a month across the shop; each kept pair carries ${returned.toFixed(2)} returned pairs.`;
      $('#flow').innerHTML = [
        ['1 · Order', 'Customer pays by card, PayPal or invoice (pay later, 14 days).'],
        ['2 · Maker ships', 'Ciabatta (Bergamo) or Ortensi (Porto Sant’Elpidio) dropships the first delivery with GLS.'],
        ['3 · Returns', 'About a quarter of pairs come back by DHL to Kade Returns in Venlo; many from size-try orders.'],
        ['4 · Kade grades', 'A: resell from Kade. B: back to Ortensi for credit within 60 days; Ciabatta takes nothing back. C: write off.'],
        ['5 · Money', 'Refund after Kade’s check. Makers invoice weekly. Agents and one operator run it.'],
      ].map(([t, s]) => `<div class="step"><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join('');
    };
    const reset = () => {
      const x = sel === 'shop' ? null : d.products.find(p => p.code === sel);
      const base = x ? forProduct(x) : shop;
      v = { ...base, ...SCENARIOS[scen].set(base) };
      drawInputs();
      render();
    };
    $('#inputs').addEventListener('input', e => { if (e.target.dataset.k) { v[e.target.dataset.k] = Number(e.target.value) || 0; render(); } });
    page.addEventListener('click', e => {
      const p = e.target.closest('[data-p]'), s = e.target.closest('[data-s]');
      if (p) { sel = p.dataset.p; reset(); }
      if (s) { scen = s.dataset.s; reset(); }
    });
    reset();
  };
})();
