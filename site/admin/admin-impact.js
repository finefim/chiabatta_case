// Ciabatta Club back office, Impact: the shop as it runs today vs. with my changes, with the levers to play with,
// and the last 30 days of history behind the numbers. Same unit-economics model as Supplies (admin-economics.js).
// History comes from impact-data.json (python3 build/make_impact_data.py), the economics from /admin/economics.
(() => {
  const { views, api, esc, head } = CC;
  const E0 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const E2 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const N0 = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 });
  const eur0 = v => E0.format(Math.round(v)), eur2 = v => E2.format(v), n0 = v => N0.format(v);
  const sign = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
  const COL = { asis: '#C2552B', plan: '#1A73A8', c3: '#B08410', c4: '#8A4F8F', c5: '#5E8A3A' };
  const AGENT_COL = { tina: COL.asis, mia: COL.plan, leo: COL.c3, nora: COL.c4, paolo: COL.c5 };

  // ---------- the unit-economics model (identical to Supplies) ----------
  function model(v) {
    const p = k => v[k] / 100;
    const r = p('return_rate'), shipped = 1 / (1 - r), returned = r / (1 - r);
    const net = v.price_incl / (1 + p('vat'));
    const cogs = v.cost * (1 + p('rise')) * (1 - p('cash_discount'));
    const dpp = v.dropship / v.pairs_per_order;
    const kept = v.orders_month * v.pairs_per_order * (1 - r);
    const back = cogs * (1 - p('credit')) + v.pallet * p('credit');
    const unsoldA = p('a_expired') * cogs + (1 - p('a_expired')) * back;
    const stock = returned * (p('grade_c') * cogs + p('grade_b') * back + p('grade_a') * (1 - p('a_resold')) * unsoldA);
    const resale = returned * p('grade_a') * p('a_resold') * (dpp - v.resale_fee);
    const cm1 = net - cogs - dpp * shipped;
    const cm2 = cm1 - returned * (v.label + v.receipt + v.storage * v.months) - stock + resale - p('fee') * v.price_incl * shipped
      - p('invoice_share') * p('credit_loss') * v.price_incl - p('dispute_rate') * (v.dispute_fee + p('dispute_lost') * v.price_incl)
      - v.agents_month / kept - v.human_month / kept;
    const cm3 = cm2 - (v.ads * v.orders_month - v.comarketing) / kept;
    return { cm1, cm2, cm3, kept, returned, resold: kept * returned * p('grade_a') * p('a_resold') };
  }

  // ---------- levers: what each one changes, with the as-is value next to it ----------
  // agent / sam: savings per month, taken from agent_runs and Sam's tasks (impact-data.json)
  const LEVERS = h => [
    { id: 'kade', owner: 'ops', label: 'Kade-first routing + pallet before day 60', note: 'Top one. build/kade_router.py',
      p: [['a_resold', 'Returned “as new” pairs resold from Kade', '%', 0, 70], ['a_expired', 'Unsold “as new” pairs too old for Ortensi’s refund', '%', 40, 5]],
      v: (v, x) => ({ ...v, a_resold: x.a_resold, a_expired: x.a_expired }) },
    { id: 'disputes', owner: 'ops', label: 'Contest disputes with the GLS delivery scan', note: 'Kill Paolo’s “<€150 accept” rule',
      p: [['dispute_lost', 'Disputes lost or accepted', '%', 50, 10]],
      v: (v, x) => ({ ...v, dispute_lost: x.dispute_lost }), sam: (x, m) => m.disputes * 0.7 },
    { id: 'refunds', owner: 'ops', label: 'Paolo: clean return refunds without approval', note: 'Code checks: Kade has it, right amount, not refunded before, no open dispute, invoice paid',
      p: [['auto_share', 'Approvals that no longer need a human', '%', 0, 35]],
      sam: (x, m, s) => m.refund_status * 0.8 + s.approvals * x.auto_share / 100 * s.min_per_approval },
    { id: 'mia', owner: 'ops', label: 'Mia: new prompt, slim context, address reaches the maker', note: 'Looks up only the products it needs instead of reading the whole catalogue every time',
      p: [['ctx_cut', 'Cut in Mia’s drafting cost', '%', 0, 50]],
      agent: x => (h.spend_by_task['mia.draft_reply'] || 0) * x.ctx_cut / 100, sam: (x, m) => m.address * 0.9 },
    { id: 'tina', owner: 'ops', label: 'Stop Tina asking GLS every 15 min; GLS notifies us instead (webhooks)', note: 'One email per milestone, never a second “on its way”',
      p: [['hook_cost', 'Webhook-driven runs per month', '€', 0, 20]],
      agent: x => (h.spend_by_task['tina.poll_tracking'] || 0) - x.hook_cost },
    { id: 'nora', owner: 'ops', label: 'Stop Nora’s hourly summary; 4 automatic alerts instead', p: [],
      agent: () => h.spend_by_task['nora.digest'] || 0 },
    { id: 'exec', owner: 'ops', label: 'Approved actions run as plain code (no AI call) and can never run twice', p: [],
      agent: () => h.spend_by_task['mia.execute_approved'] || 0 },
    { id: 'sftp', owner: 'ops', label: 'Ciabatta file exchange (SFTP): orders, stock, tracking', note: 'No more late cancels and out-of-stock surprises', p: [],
      sam: (x, m) => m.late_cancel * 0.5 },
    { id: 'cash', owner: 'elena', label: 'Pay Ortensi within 10 days for the 2% discount', note: 'A cash decision',
      p: [['cash', 'Cash discount on Ortensi', '%', 0, 2]], v: (v, x, s) => ({ ...v, cash_discount: x.cash * (v._ort ?? 1) }) },
    { id: 'cbcredit', owner: 'elena', label: 'Ciabatta credits unsold returns, like Ortensi', note: 'Contract has 60 days’ notice', off: true,
      p: [['cb_credit', 'Credit on unsold Ciabatta pairs', '%', 0, 100]],
      v: (v, x) => ({ ...v, credit: v._ort * 100 + (1 - v._ort) * x.cb_credit }) },
    { id: 'ads', owner: 'elena', label: 'Paid ads per order', off: true,
      p: [['ads', 'Paid ads per order', '€', 18, 12]], v: (v, x) => ({ ...v, ads: x.ads }) },
  ];

  views.impact = async page => {
    const [d, h] = await Promise.all([api('/admin/economics'), fetch('impact-data.json').then(r => r.json())]);
    const mix = d.payment_mix, s = d.ortensi_pair_share;
    const shared = {
      vat: 20, pairs_per_order: +d.pairs_per_order.toFixed(2), label: 8.4, receipt: 1.6, storage: 0.4, months: 1, a_resold: 0, a_expired: 40, resale_fee: 6.75, pallet: 0.9,
      fee: +(mix.card * 1.9 + mix.paypal * 2.9 + mix.invoice * 2.5).toFixed(2), invoice_share: +(mix.invoice * 100).toFixed(0), credit_loss: +(d.credit_loss_rate * 100).toFixed(1),
      dispute_rate: +(d.dispute_rate * 100).toFixed(2), dispute_fee: 15, dispute_lost: 50, human_month: 4800, ads: 18, comarketing: 0, cash_discount: 0,
    };
    const shopBase = {
      ...shared, price_incl: +d.avg_price_incl_vat.toFixed(2), cost: +(s * d.avg_cost_ortensi + (1 - s) * d.avg_cost_ciabatta).toFixed(2), rise: +(8 * s).toFixed(1),
      dropship: +(7.9 * s + 6.5 * (1 - s)).toFixed(2), return_rate: +(d.return_rate * 100).toFixed(1), grade_a: +(d.grade_shares.A * 100).toFixed(0),
      grade_b: +(d.grade_shares.B * 100).toFixed(0), grade_c: +(d.grade_shares.C * 100).toFixed(0), credit: +(100 * s).toFixed(0), _ort: s,
    };
    const prodBase = x => {
      const o = x.supplier === 'Ortensi';
      return { ...shared, price_incl: x.price_incl, cost: x.cost, rise: o ? 8 : 0, dropship: o ? 7.9 : 6.5, return_rate: +(x.return_rate * 100).toFixed(1),
        grade_a: +(x.grade_shares.A * 100).toFixed(0), grade_b: +(x.grade_shares.B * 100).toFixed(0), grade_c: +(x.grade_shares.C * 100).toFixed(0), credit: o ? 100 : 0, _ort: o ? 1 : 0 };
    };
    const agentAsIs = Object.values(h.spend).reduce((a, arr) => a + arr.reduce((x, y) => x + y, 0), 0);
    const samMin = h.sam_minutes, samTasks = Object.values(samMin).reduce((a, b) => a + b, 0);
    const levers = LEVERS(h);

    // state
    const SCEN0 = { orders_month: d.orders, return_rate: shopBase.return_rate, min_per_approval: 1 };
    let scen, on, val;
    const plan = () => { scen = { ...SCEN0 }; on = Object.fromEntries(levers.map(l => [l.id, !l.off])); val = Object.fromEntries(levers.flatMap(l => l.p.map(q => [q[0], q[4]]))); };
    const asIsOnly = () => { plan(); levers.forEach(l => { on[l.id] = false; }); };
    plan();

    function compute() {
      const vol = scen.orders_month / d.orders;
      const st = { approvals: h.approvals_decided_30d * vol, min_per_approval: scen.min_per_approval };
      const mScaled = Object.fromEntries(Object.entries(samMin).map(([k, v]) => [k, v * vol]));
      const active = levers.filter(l => on[l.id]);
      const agentSave = active.reduce((a, l) => a + (l.agent ? l.agent(val) : 0), 0);
      const samSave = active.reduce((a, l) => a + (l.sam ? l.sam(val, mScaled, st) : 0), 0);
      const samAsIs = (samTasks * vol + st.approvals * st.min_per_approval) / 60;
      const sc = v => ({ ...v, orders_month: scen.orders_month, agents_month: agentAsIs, ...(v._ort === s ? { return_rate: scen.return_rate } : {}) });
      const asIsShop = sc(shopBase);
      // bridge: apply levers one by one on the shop
      let v = asIsShop, prev = model(v).cm3, agentsNow = agentAsIs;
      const steps = [];
      for (const l of active) {
        if (l.v) v = l.v(v, val);
        if (l.agent) { agentsNow -= l.agent(val); v = { ...v, agents_month: Math.max(0, agentsNow) }; }
        const now = model(v).cm3;
        steps.push({ l, delta: now - prev, at: now, hours: l.sam ? l.sam(val, mScaled, st) / 60 : 0, agent: l.agent ? l.agent(val) : 0 });
        prev = now;
      }
      const planShop = v;
      const applyAll = base => active.reduce((w, l) => (l.v ? l.v(w, val) : w), { ...base, agents_month: Math.max(0, agentsNow), orders_month: scen.orders_month });
      const products = d.products.map(x => {
        const pb = prodBase(x);
        const b = { ...pb, return_rate: Math.min(95, pb.return_rate * scen.return_rate / shopBase.return_rate), orders_month: scen.orders_month, agents_month: agentAsIs };
        return { x, asis: model(b).cm3, plan: model(applyAll(b)).cm3 };
      });
      return { a: model(asIsShop), p: model(planShop), steps, products, agentsAsIs: agentAsIs, agentsPlan: Math.max(0, agentsNow),
        samAsIs, samPlan: Math.max(0, samAsIs - samSave / 60), vol,
        clicksAsIs: st.approvals, clicksPlan: st.approvals * (on.refunds ? 1 - val.auto_share / 100 : 1) };
    }

    page.innerHTML = `<div class="impact">` + head('Impact', 'The shop as it runs today vs. with my changes. Switch levers on and off, change the yellow cells and every number below follows. The money model is the same one as on <a href="#/supplies">Supplies</a>; the history is the last 30 days of data.') + `
      <p class="lede">The number I steer by is <b>profit per pair the customer keeps, after ads</b> (called CM3 in the code): about a quarter of pairs come back, so every kept pair carries the cost of the returned ones. Levers marked <span class="owner elena">Elena</span> are prices, terms and partners: hers to decide, shown here so she can see what they’re worth.</p>
      <div class="card money" id="money"></div>
      <div class="card money handimp" id="handimp"></div>
      <div class="scen" id="presets"></div>
      <div class="tiles" id="tiles"></div>
      <div class="econ" style="margin-top:16px">
        <div class="card"><h2>Levers</h2><div class="inputs" id="scen"></div><div class="levers" id="levers" style="margin-top:12px"></div></div>
        <div class="grid">
          <div class="card"><h2>From today to the plan: profit per pair kept</h2><p class="sub">Each switched-on lever, in order, and what it adds per kept pair.</p><div class="wf" id="bridge"></div></div>
          <div class="card"><h2>Per product: as is vs. plan</h2><div class="legend"><span><i style="background:${COL.asis}"></i>As is</span><span><i style="background:${COL.plan}"></i>With the plan</span></div><div class="wf" id="prods"></div>
            <p class="take faint">Ciabatta lines lose most: Ciabatta takes nothing back, and 40–44% of its pairs are returned.</p></div>
        </div>
      </div>
      <h2 class="sec-h">History: the last 30 days</h2>
      <div class="statrow card" id="stats"></div>
      <div class="charts" style="margin-top:16px">
        <div class="card"><h2>Kade-first, tested on last month’s orders</h2><p class="sub">What the router would have saved each day if it had been running, vs. what we actually resold.</p><div class="chart" id="c-backtest"></div><p class="take" id="t-backtest"></p></div>
        <div class="card"><h2>“As new” returned pairs sitting at Kade</h2><p class="sub">Pairs we already own, on Kade’s shelf at the end of each day.</p><div class="chart" id="c-shelf"></div><p class="take" id="t-shelf"></p></div>
        <div class="card"><h2>Orders, returns and Kade’s checks per day</h2><p class="sub">Returns pile up faster than Kade checks them; an unchecked pair can’t be refunded or resold.</p><div class="chart" id="c-flow"></div><p class="take" id="t-flow"></p></div>
        <div class="card"><h2>Approval queue at the end of each day</h2><p class="sub">Actions waiting for a human. Weekends and Sam’s holiday show up as spikes.</p><div class="chart" id="c-queue"></div><p class="take" id="t-queue"></p></div>
        <div class="card"><h2>Agent spend per day</h2><p class="sub">Model cost by agent. Tina’s polling is the biggest single line.</p><div class="chart" id="c-spend"></div><p class="take" id="t-spend"></p></div>
        <div class="card"><h2>Where Sam’s logged time went</h2><p class="sub">Minutes on hand-made tasks in the window, by kind of task.</p><div class="chart" id="c-sam"></div><p class="take" id="t-sam"></p></div>
      </div></div>`;
    const $ = sel => page.querySelector(sel);

    // ---------- controls ----------
    const drawControls = () => {
      $('#presets').innerHTML = `<button class="chip" data-preset="plan">My plan</button><button class="chip" data-preset="asis">Everything off (as is)</button><button class="chip" data-preset="all">My plan + Elena’s levers</button>`;
      $('#scen').innerHTML = `<h3>Scenario</h3>` + [['orders_month', 'Orders per month (July: try +30%)', ''], ['return_rate', 'Share of pairs returned', '%'], ['min_per_approval', 'Minutes per approval click', 'min']]
        .map(([k, l, u]) => `<label class="in"><span>${esc(l)} <span class="faint">${u}</span></span><input type="number" step="any" data-s="${k}" value="${scen[k]}"></label>`).join('');
      $('#levers').innerHTML = levers.map(l => `<div class="lever ${on[l.id] ? '' : 'off'}" data-l="${l.id}">
        <label class="lever__top"><input type="checkbox" data-t="${l.id}" ${on[l.id] ? 'checked' : ''}><span><b>${esc(l.label)}</b>${l.note ? `<small>${esc(l.note)}</small>` : ''}</span><span class="owner ${l.owner}">${l.owner === 'ops' ? 'Ops' : 'Elena'}</span></label>
        ${l.p.map(([k, lab, u, asis]) => `<div class="lever__p"><span>${esc(lab)} <span class="faint">${u}</span></span><input type="number" step="any" data-v="${k}" value="${val[k]}" ${on[l.id] ? '' : 'disabled'}><span class="asis">as is: ${asis}${u === '%' ? '%' : u === '€' ? ' €' : ''}</span></div>`).join('')}</div>`).join('');
    };

    // ---------- results ----------
    const tile = (k, a, p, fmt, better, note) => {
      const dlt = p - a, good = better === 'up' ? dlt > 0 : dlt < 0;
      return `<div class="tile"><span class="k">${esc(k)}</span><div class="vals"><span><i style="background:${COL.asis}"></i>As is</span><b>${fmt(a)}</b>
        <span><i style="background:${COL.plan}"></i>Plan</span><b class="plan">${fmt(p)}</b></div>
        <span class="delta ${Math.abs(dlt) < 1e-9 ? '' : good ? 'up' : 'down'}">${sign(dlt, fmt)}</span>${note ? `<span class="note">${note}</span>` : ''}</div>`;
    };
    const bridgeRow = (label, from, to, kind, scale, lo, alt) => {
      const x = v => ((v - lo) / scale) * 100;
      const left = Math.min(x(from), x(to)), w = Math.max(0.6, Math.abs(x(to) - x(from)));
      return `<div class="r ${kind === 'total' ? 'total' : ''}"><span>${label}</span><span class="mono" style="text-align:right">${kind === 'total' ? eur2(to) : alt || sign(to - from, eur2)}</span>
        <span class="track"><span class="zero" style="left:${x(0)}%"></span><span class="seg ${kind}" style="left:${left}%;width:${w}%" title="${esc(label)}: ${kind === 'total' ? eur2(to) : sign(to - from, eur2)}"></span></span></div>`;
    };
    const render = () => {
      const r = compute();
      $('#tiles').innerHTML = [
        tile('Profit per pair kept (after ads)', r.a.cm3, r.p.cm3, eur2, 'up', 'What one kept pair leaves us after ads'),
        tile('Profit per month (after ads)', r.a.cm3 * r.a.kept, r.p.cm3 * r.p.kept, eur0, 'up', `${n0(r.p.kept)} kept pairs a month`),
        tile('Agent spend per month', r.agentsAsIs, r.agentsPlan, eur0, 'down', 'Model cost, from agent_runs'),
        tile('Sam’s manual work, h/month', r.samAsIs, r.samPlan, v => n0(v) + ' h', 'down', 'Logged tasks + approval clicks'),
        tile('“As new” returns resold per month', r.a.resold, r.p.resold, n0, 'up', 'Once running fully, at today’s return rate; Kade’s slow checking holds it back now'),
        tile('Approvals a human clicks / month', r.clicksAsIs, r.clicksPlan, n0, 'down', 'Elena’s goal: one person per ~2,000 customers'),
      ].join('');
      // bridge
      const pts = [r.a.cm3, ...r.steps.map(s2 => s2.at), 0];
      const lo = Math.min(...pts), hi = Math.max(...pts), scale = (hi - lo) || 1;
      $('#bridge').innerHTML = bridgeRow('As is', 0, r.a.cm3, 'total', scale, lo).replace('seg total', 'seg asis') +
        r.steps.map(s2 => bridgeRow(esc(s2.l.label) + (s2.hours >= 0.5 ? ` <span class="faint">· −${n0(s2.hours)} h of Sam’s time</span>` : ''),
          s2.at - s2.delta, s2.at, s2.delta >= 0 ? 'gain' : 'loss', scale, lo, Math.abs(s2.delta) < 0.005 ? '<span class="faint">time only</span>' : '')).join('') +
        bridgeRow('With the plan', 0, r.p.cm3, 'total', scale, lo).replace(/seg total/, 'seg plan');
      // per product
      const all = r.products.flatMap(x => [x.asis, x.plan, 0]);
      const plo = Math.min(...all), phi = Math.max(...all), psc = (phi - plo) || 1;
      const px = v => ((v - plo) / psc) * 100;
      const pbar = (v, cls) => `<span class="seg ${cls}" style="left:${Math.min(px(0), px(v))}%;width:${Math.max(0.6, Math.abs(px(v) - px(0)))}%;height:6px;top:${cls === 'asis' ? 0 : 7}px"></span>`;
      $('#prods').innerHTML = r.products.map(x => `<div class="r"><span>${esc(x.x.name)} <span class="faint">${esc(x.x.supplier)}</span></span>
        <span class="mono" style="text-align:right">${eur2(x.plan)}<br><span class="faint">${eur2(x.asis)}</span></span>
        <span class="track" title="${esc(x.x.name)}: as is ${eur2(x.asis)}, plan ${eur2(x.plan)}"><span class="zero" style="left:${px(0)}%"></span>${pbar(x.asis, 'asis')}${pbar(x.plan, 'plan')}</span></div>`).join('');
    };

    page.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.s) scen[t.dataset.s] = Number(t.value) || 0;
      if (t.dataset.v) val[t.dataset.v] = Number(t.value) || 0;
      if (t.dataset.t) { on[t.dataset.t] = t.checked; drawControls(); }
      render();
    });
    page.addEventListener('click', e => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      if (b.dataset.preset === 'asis') asIsOnly(); else plan();
      if (b.dataset.preset === 'all') levers.forEach(l => { on[l.id] = true; });
      drawControls(); render();
    });
    drawControls(); render();

    // ---------- where the money is: measured on the last 30 days vs. the model at steady state ----------
    (() => {
      const base = { ...shopBase, orders_month: d.orders, agents_month: agentAsIs }, m0 = model(base);
      const lift = patch => (model({ ...base, ...patch }).cm3 - m0.cm3) * m0.kept;
      const dl = h.disputes, lostDelivered = dl.accepted.eur + dl.accepted.fee + dl.lost.eur + dl.lost.fee;
      const rows = [
        { k: 'Kade-first routing', who: 'ops', measured: h.backtest.total, model: lift({ a_resold: 70, a_expired: 5 }),
          proof: `Tested on all ${n0(d.orders)} orders of the last 30 days: ${n0(h.backtest.orders)} could have shipped from Kade. Plus ${eur0(h.today_plan.saving)} once, today (${h.today_plan.orders} open orders). Held back now by Kade’s check backlog (${h.unscanned_at_kade} returns unchecked).` },
        { k: 'Agent cost: code, slim context, smaller models', who: 'ops', measured: agentAsIs - 50, model: agentAsIs - 50,
          proof: `${eur0(agentAsIs)} spent in agent_runs over 30 days; target ~€50. The money is small; the value is scale and fewer mistakes.` },
        { k: 'Contest disputes with the GLS scan', who: 'ops', measured: lostDelivered, model: lift({ dispute_lost: 10 }),
          proof: `${dl.accepted.n + dl.lost.n} disputes lost or accepted (${eur0(lostDelivered)} incl. fees), every one on an order GLS marked delivered. ${dl.open.n} more open (${eur0(dl.open.eur)}).` },
        { k: 'Ciabatta credits unsold returns', who: 'elena', measured: null, model: lift({ credit: 100 }),
          proof: 'Model only: Ciabatta takes nothing back, so every unsold returned pair is a full write-off. About €5.5k a month if Kade-first already runs (they overlap).' },
        { k: 'Paid ads €18 → €12 per order', who: 'elena', measured: null, model: lift({ ads: 12 }),
          proof: 'Model only: ads are the largest cost per kept pair (~€17).' },
      ];
      const max = Math.max(...rows.map(r => Math.max(r.model, r.measured || 0)));
      const w = v => `${Math.max(0.8, (v / max) * 100)}%`;
      const kade = rows[0], ag = rows[1];
      $('#money').innerHTML = `<h2>Where the money is</h2>
        <p class="money__lead">Kade-first is the biggest lever we control: <b>${eur0(kade.measured)}</b> a month proven on last month’s orders, up to <b>${eur0(kade.model)}</b> once Kade checks returns on time. Cutting agent cost saves <b>${eur0(ag.measured)}</b> a month: it buys scale, not margin. The two largest levers belong to Elena.</p>
        <div class="legend"><span><i style="background:${COL.plan}"></i>Proven on the last 30 days</span><span><i style="background:${COL.plan};opacity:.3"></i>Estimate, once running fully</span></div>
        <div class="mrows"><div class="mrow mrow--h"><span></span><span class="mrow__v"><span>Proven / month</span><span>Estimate / month</span></span><span></span></div>${rows.map(r => `<div class="mrow">
          <div class="mrow__k"><b>${esc(r.k)}</b> <span class="owner ${r.who}">${r.who === 'ops' ? 'Ops' : 'Elena'}</span><small>${esc(r.proof)}</small></div>
          <div class="mrow__v"><span class="mono">${r.measured == null ? '<span class="faint" style="font-weight:400;font-size:12px">model only</span>' : eur0(r.measured)}</span><span class="mono faint">${eur0(r.model)}</span></div>
          <div class="mrow__b"><span class="mb model" style="width:${w(r.model)}"></span>${r.measured == null ? '' : `<span class="mb meas" style="width:${w(r.measured)}"></span>`}</div></div>`).join('')}</div>
        <p class="faint" style="margin:10px 0 0;font-size:12.5px">€ per month. “Proven” = recalculated from the shop’s real data for the last 30 days (build/make_impact_data.py). “Estimate” = the shop’s profit calculator (the Supplies page) with only that one change, at today’s order volume.</p>`;
    })();

    // ---------- handoffs journal: what it buys (replay of inbox + chat, build/handoffs.py) ----------
    fetch('handoffs-data.json').then(r => r.json()).then(hd => {
      const H = hd.handoffs, med = H.map(r => r.open_h).sort((a, b) => a - b)[Math.floor(H.length / 2)] / 24;
      const tina = H.find(r => r.about === 'no-tracking');
      const atRisk = [
        ['Ortensi +8% on 12 days’ notice, not 30: to Elena in 72 h, not filed as “no action”', 3528],
        ['13 Ortensi pairs at Kade, 45–60 days old: pallet before the credit runs out', 596],
        ['Dispute on CC-11202, delivered per GLS: contested, not accepted', 154],
      ];
      $('#handimp').innerHTML = `<h2>Handoffs journal: what it buys</h2>
        <p class="money__lead">Not a cost cut: it makes sure the money above isn’t lost in the chat. Tested on the inbox and the agents’ chat, <b>${hd.summary.open_now} of ${H.length}</b> handoffs were still open on Monday with no owner, for <b>${med.toFixed(1)} days</b> in the middle case. With an owner per topic and a watchdog, a human has each one within <b>24 h</b>.</p>
        <div class="statrow">
          <div><b>${hd.summary.open_now} → 0</b><span>handoffs with no owner</span></div>
          <div><b>${med.toFixed(1)} d → ≤ 24 h</b><span>until a human has it (median today)</span></div>
          <div><b>${hd.noise.digest + tina.repeats - 1}</b><span>chat posts removed (${hd.noise.digest} Nora summaries, ${tina.repeats} identical Tina asks → 1 row)</span></div>
          <div><b>${eur0(atRisk.reduce((a, r) => a + r[1], 0))}</b><span>money at risk surfaced in time, one-off</span></div>
        </div>
        <ul class="plain" style="margin-top:12px">${atRisk.map(([k, v]) => `<li><span class="mono">${eur0(v)}</span>${esc(k)}</li>`).join('')}
          <li><span class="mono">—</span>Not in euros but bigger: the Ciabatta credit hold (a third of our pairs) and the dead Ortensi stock feed would each have reached a human days earlier.</li></ul>
        <p class="faint" style="margin:10px 0 0;font-size:12.5px">Details per handoff on the <a href="#/handoffs">Handoffs</a> tab · in the plan: priority 2, 16–19 June.</p>`;
    }).catch(() => { $('#handimp').remove(); });

    // ---------- history ----------
    const days = h.days, lab = days.map(x => x.slice(5).replace('-', '/'));
    lab[lab.length - 1] += '*';
    const sum = a => a.reduce((x, y) => x + y, 0);
    const full = a => a.slice(0, -1), labF = full(lab);  // 15 June is a partial day (to 06:30): flows use full days only
    const deliveredReturns = sum(h.returns_requested), scans = sum(h.kade_scans);
    $('#stats').innerHTML = [
      [eur0(h.backtest.total), `the router would have saved (${h.backtest.orders} orders)`],
      ['0', 'pairs actually resold from Kade (manual runs stopped 14 May)'],
      [n0(h.unscanned_at_kade), 'returns delivered to Kade but not yet checked'],
      [`${h.queue.at(-1)} · ${Math.round(h.queue_oldest_h.at(-1))} h`, 'approvals waiting · oldest wait now'],
      [eur0(agentAsIs), 'agent spend in 30 days'],
      [`${h.disputes.won.n} / ${h.disputes.lost.n + h.disputes.accepted.n}`, `disputes won / lost or accepted; ${h.disputes.open.n} open (${eur0(h.disputes.open.eur)}), all delivered`],
      [`${h.reviews_avg} ★`, `review average (${h.reviews_n}); ${Object.values(h.reviews).join(' → ')} over the month`],
    ].map(([b, t]) => `<div><b>${esc(b)}</b><span>${esc(t)}</span></div>`).join('');

    chart($('#c-backtest'), { type: 'bar', labels: labF, fmt: eur0, series: [{ name: 'Router saving', color: COL.plan, values: full(h.backtest.saving), extra: full(h.backtest.pairs).map(p => `${p} pairs`) }, { name: 'Actually resold (pairs)', color: COL.asis, values: full(h.backtest.actual_resold), hidden: true }] });
    $('#t-backtest').textContent = `${eur0(h.backtest.total)} in 30 days, ${n0(sum(h.backtest.pairs))} pairs. What actually happened: nothing was resold. The first days are high because older stock was already waiting.`;
    chart($('#c-shelf'), { type: 'line', labels: lab, fmt: n0, series: [{ name: 'As is', color: COL.asis, values: h.shelf.as_is }, { name: 'With the router', color: COL.plan, values: h.shelf.router }] });
    $('#t-shelf').textContent = `As is the shelf grows from ${h.shelf.as_is[0]} to ${h.shelf.as_is.at(-1)} pairs; with the router it stays around ${Math.round(sum(h.shelf.router) / h.shelf.router.length)}. ${h.ortensi_pairs_past_60} Ortensi pairs on the shelf are already past their 60-day credit.`;
    chart($('#c-flow'), { type: 'line', labels: labF, fmt: n0, series: [{ name: 'Orders', color: COL.c4, values: full(h.orders) }, { name: 'Returns requested', color: COL.asis, values: full(h.returns_requested) }, { name: 'Checked by Kade', color: COL.plan, values: full(h.kade_scans) }] });
    $('#t-flow').textContent = `${n0(deliveredReturns)} returns requested, ${n0(scans)} checked by Kade in the same 30 days.`;
    chart($('#c-queue'), { type: 'bar', labels: lab, fmt: n0, series: [{ name: 'Pending approvals', color: COL.c3, values: h.queue, extra: h.queue_oldest_h.map(x => `oldest ${Math.round(x)} h`) }] });
    $('#t-queue').textContent = `${h.approvals_decided_30d} approvals clicked in 30 days. Now ${h.queue.at(-1)} waiting, the oldest for ${Math.round(h.queue_oldest_h.at(-1))} hours.`;
    chart($('#c-spend'), { type: 'stack', labels: labF, fmt: eur0, series: h.agents.map(a => ({ name: a[0].toUpperCase() + a.slice(1), color: AGENT_COL[a], values: full(h.spend[a]) })) });
    $('#t-spend').textContent = h.agents.map(a => `${a[0].toUpperCase() + a.slice(1)} ${eur0(sum(h.spend[a]))}`).join(' · ');
    const samKeys = Object.entries(h.sam_minutes).sort((a, b) => b[1] - a[1]);
    const SAMLAB = { address: 'Address changes to makers', refund_status: '“Where’s my refund?”', disputes: 'Dispute evidence', late_cancel: 'Late cancels', gls_redirect: 'GLS redirects', ortensi_call: 'Weekly call with Chiara', paylater: 'Pay-later reminders', other: 'Other' };
    chart($('#c-sam'), { type: 'hbar', labels: samKeys.map(([k]) => SAMLAB[k] || k), fmt: v => `${n0(v)} min`, series: [{ name: 'Minutes', color: COL.c5, values: samKeys.map(([, v]) => v) }] });
    $('#t-sam').textContent = `${n0(samTasks)} minutes (${n0(samTasks / 60)} h) of logged tasks, plus ~${h.approvals_decided_30d} approval clicks. The call with Chiara stays human on purpose.`;
  };

  // ---------- small SVG charts with a hover layer and a table view ----------
  function chart(el, c) {
    const series = c.series.filter(s => !s.hidden);
    const W = 640, H = c.type === 'hbar' ? 28 * c.labels.length + 30 : 230, L = c.type === 'hbar' ? 190 : 46, R = 12, T = 12, B = c.type === 'hbar' ? 18 : 26;
    const iw = W - L - R, ih = H - T - B, n = c.labels.length;
    const totals = c.labels.map((_, i) => (c.type === 'stack' ? series.reduce((a, s) => a + s.values[i], 0) : Math.max(...series.map(s => s.values[i]))));
    const max = niceMax(Math.max(1, ...totals));
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.series.map(s => s.name).join(', '))}">`;
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="${c.type === 'line' ? 'dash' : ''}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    if (c.type === 'hbar') {
      const bh = 16, gap = 28, x = v => L + (v / max) * iw;
      c.labels.forEach((lb, i) => {
        const y = T + i * gap, v = series[0].values[i], w = Math.max(1, x(v) - L);
        svg += `<text class="lbl" x="${L - 8}" y="${y + bh / 2 + 4}" text-anchor="end">${esc(lb)}</text>`;
        svg += `<path d="M${L},${y} h${w - 4} a4,4 0 0 1 4,4 v${bh - 8} a4,4 0 0 1 -4,4 h-${w - 4} z" fill="${series[0].color}"><title>${esc(lb)}: ${c.fmt(v)}</title></path>`;
        svg += `<text class="dlabel" x="${L + w + 6}" y="${y + bh / 2 + 4}">${c.fmt(v)}</text>`;
      });
      el.innerHTML = svg + `<line class="base" x1="${L}" x2="${L}" y1="${T - 4}" y2="${H - B + 4}"/></svg>` + dataTable(c);
      return;
    }
    const y = v => T + ih - (v / max) * ih, step = iw / n, xc = i => L + step * i + step / 2;
    svg += `<g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>`;
    svg += `<g class="axis">${ticks.map(t => `<text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${esc(c.fmt(t))}</text>`).join('')}`;
    c.labels.forEach((lb, i) => { if (i % 5 === 0 || i === n - 1) svg += `<text x="${xc(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`; });
    svg += `</g>`;
    if (c.type === 'line') {
      series.forEach(s => {
        svg += `<path d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${xc(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        const i = n - 1;
        svg += `<circle cx="${xc(i)}" cy="${y(s.values[i])}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
      });
    } else {
      const bw = Math.max(3, step - 4);
      c.labels.forEach((_, i) => {
        let base = 0;
        const list = c.type === 'stack' ? series : [series[0]];
        list.forEach((s, k) => {
          const v = s.values[i];
          if (v <= 0) return;
          const y0 = y(base), y1 = y(base + v), top = k === list.length - 1 || c.type !== 'stack';
          const hgt = Math.max(0.5, y0 - y1 - (c.type === 'stack' && base > 0 ? 2 : 0));
          const r = top ? Math.min(4, bw / 2, hgt) : 0, x0 = xc(i) - bw / 2;
          svg += r ? `<path d="M${x0},${y1 + hgt} v-${hgt - r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hgt - r} z" fill="${s.color}"/>`
            : `<rect x="${x0}" y="${y1}" width="${bw}" height="${hgt}" fill="${s.color}"/>`;
          base += v;
        });
      });
    }
    svg += `<line class="base" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    svg += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="display:none"/>`;
    c.labels.forEach((_, i) => { svg += `<rect class="hit" data-i="${i}" x="${L + step * i}" y="${T}" width="${step}" height="${ih}"/>`; });
    el.innerHTML = legend + svg + `</svg><div class="tip" style="display:none"></div>` + dataTable(c);
    const svgEl = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = el.querySelector('.cross');
    const show = i => {
      const box = svgEl.getBoundingClientRect(), k = box.width / W, oy = box.top - el.getBoundingClientRect().top;
      cross.setAttribute('x1', xc(i)); cross.setAttribute('x2', xc(i)); cross.style.display = '';
      tip.innerHTML = `<b>${esc(c.labels[i])}</b>` + series.map(s => `<div class="r"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><span>${esc(c.fmt(s.values[i]))}${s.extra ? ` · ${esc(s.extra[i])}` : ''}</span></div>`).join('')
        + (c.type === 'stack' ? `<div class="r"><span>Total</span><span>${esc(c.fmt(totals[i]))}</span></div>` : '');
      tip.style.display = '';
      const left = Math.min(Math.max(xc(i) * k, 90), box.width - 90);
      tip.style.left = `${left}px`; tip.style.top = `${oy + T * k + 4}px`;
    };
    svgEl.addEventListener('mousemove', e => { const t = e.target.closest('.hit'); if (t) show(+t.dataset.i); });
    svgEl.addEventListener('mouseleave', () => { tip.style.display = 'none'; cross.style.display = 'none'; });
    svgEl.addEventListener('touchstart', e => { const t = e.target.closest('.hit'); if (t) show(+t.dataset.i); }, { passive: true });
  }
  function niceMax(v) { const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function dataTable(c) {
    return `<details class="data"><summary>Show the data</summary><div class="table-wrap"><table><thead><tr><th></th>${c.series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${
      c.labels.map((lb, i) => `<tr><td class="mono">${esc(lb)}</td>${c.series.map(s => `<td class="mono">${esc(c.fmt(s.values[i]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
})();
