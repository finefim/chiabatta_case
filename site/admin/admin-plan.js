// Ciabatta Club back office, Plan: my first two weeks covering for Sam (Mon 15 to Fri 26 June).
// Three priorities, a timeline, the day-by-day list with the evidence behind each item, and the
// day-14 numbers next to where they stand right now (read live from the same APIs as the rest of the office).
// Ticks are kept in this browser only (localStorage).
(() => {
  const { views, api, esc, head, SIM_NOW } = CC;
  const KEY = 'cc-plan-done-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: ticks just don't persist */ } };
  const E0 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const t = (tab, col, val) => `#/t/${tab}${col ? `?col=${col}&val=${encodeURIComponent(val)}` : ''}`;

  const LANES = [
    { id: 'money', n: 1, name: 'Stop the money leak', color: '#C2552B',
      why: 'Every kept pair loses €11.11 today. Kade-first is the biggest lever (+€7.03 per kept pair).' },
    { id: 'queue', n: 2, name: 'Approval queue under control', color: '#1A73A8',
      why: '194 actions wait, the oldest for 64 h. Customers wait with them, and reviews fell from 3.8 to 2.5 stars.' },
    { id: 'pipes', n: 3, name: 'Supplier pipes without a human', color: '#5E8A3A',
      why: 'Stock data is days old, Ciabatta still gets one email per order, and agents cost €1,306 a month.' },
  ];

  // owner: me · elena · code · agent · supplier
  const ITEMS = [
    // ---- Monday 15 June: the fires (before 12:00 UTC Ortensi batch, 11:00 UTC Ciabatta key-in)
    { id: 'pay-ciabatta', lane: 'money', start: '06-15', end: '06-15', owner: 'me', title: 'Pay Ciabatta CB-INV-0518, 0525, 0601 (€26,858)',
      done: 'Paid today; no credit hold on 16 June', links: [['Invoices', t('supplier_invoices', 'status', 'awaiting_approval')], ['Final reminder', t('ops_inbox', 'id', 'mail_0021')]] },
    { id: 'kade-today', lane: 'money', start: '06-15', end: '06-15', owner: 'code', title: 'Run Kade-first before the cut-offs: 92 orders from Kade',
      done: 'Ortensi cancels sent before 12:00 UTC, Ciabatta list before 11:00 UTC, Kade pick list sent', links: [['Kade stock', t('kade_stock', 'status', 'available')], ['Impact', '#/impact']] },
    { id: 'disputes', lane: 'money', start: '06-15', end: '06-15', owner: 'me', title: 'Contest the 17 open disputes with the GLS delivery scan',
      done: 'Reject Paolo’s “accept” on CC-11202; the 4 due by Thursday contested today', links: [['Open disputes', t('disputes', 'status', 'open')], ['act_101283', t('agent_actions', 'action_id', 'act_101283')]] },
    { id: 'chiara', lane: 'pipes', start: '06-15', end: '06-15', owner: 'me', title: 'Answer the makers: cancel ORT-26-33678, partial-ship the held orders',
      done: 'Chiara has one answer per order; Giada knows wait/cancel for the 17 held orders; Mia asks each customer', links: [['mail_0024', t('ops_inbox', 'id', 'mail_0024')], ['mail_0009', t('ops_inbox', 'id', 'mail_0009')], ['mail_0018', t('ops_inbox', 'id', 'mail_0018')]] },
    { id: 'token', lane: 'pipes', start: '06-15', end: '06-15', owner: 'elena', title: 'Renew the Ortensi access key (API token); add a second admin; 90-day reminder',
      done: 'Stock feed green again; shop stops selling Capri Nero 42/43', links: [['Integrations', t('integrations')], ['mail_0016', t('ops_inbox', 'id', 'mail_0016')]] },
    { id: 'queue-clean', lane: 'queue', start: '06-15', end: '06-15', owner: 'me', title: 'Clear the 194 pending actions: approve the clean ones, reject 6 that lose money',
      done: 'Double refund, pre-scan refunds, 20% code, cash refunds on unpaid invoices rejected or edited', links: [['Pending', t('agent_actions', 'status', 'pending')], ['act_101268', t('agent_actions', 'action_id', 'act_101268')]] },
    { id: 'address', lane: 'queue', start: '06-15', end: '06-15', owner: 'me', title: 'Tell Ortensi the new address on CC-11785 (or GLS redirect, €6)',
      done: 'Parcel goes to the address the customer gave', links: [['CC-11785', t('orders', 'order_id', 'CC-11785')]] },
    // ---- Week 1
    { id: 'pallet', lane: 'money', start: '06-16', end: '06-16', owner: 'supplier', title: 'Kade: return pallet to Ortensi for pairs 45+ days old',
      done: 'No Ortensi pair at Kade passes day 60', links: [['Kade stock', t('kade_stock', 'status', 'available')]] },
    { id: 'elena', lane: 'money', start: '06-16', end: '06-16', owner: 'elena', title: 'Elena, 30 min: Ortensi 8% notice (€3,528), 3 cancelled orders billed, 2% early pay, Ciabatta credit, ads',
      done: 'A decision on each of the five; I prepare the numbers, she makes the call', links: [['mail_0003', t('ops_inbox', 'id', 'mail_0003')], ['FT-2026/0462', t('supplier_invoices', 'invoice_id', 'FT-2026/0462')], ['Supplies', '#/supplies']] },
    { id: 'kade-approve', lane: 'money', start: '06-15', end: '06-19', owner: 'code', title: 'Kade-first daily at 06:00 UTC; I approve each plan',
      done: '5 plans approved with 0 wrong reroutes and every pick confirmed by Kade', links: [['build/kade_router.py', '#/files']] },
    { id: 'kade-scan', lane: 'money', start: '06-17', end: '06-17', owner: 'supplier', title: 'Kade: check first the returns of our best-selling products (by DHL number)',
      done: 'Check backlog under 100 returns (328 today)', links: [['Returns', t('returns')], ['mail_0013', t('ops_inbox', 'id', 'mail_0013')]] },
    { id: 'exec', lane: 'queue', start: '06-16', end: '06-17', owner: 'code', title: 'Approved actions run as plain code (no AI call) and can never run twice',
      done: 'Mia’s execute runs off (€184/month); a second click can’t refund twice', links: [['Runs', t('agent_runs', 'task', 'execute_approved')]] },
    { id: 'leo-fix', lane: 'queue', start: '06-16', end: '06-16', owner: 'agent', title: 'Leo: an order counts as placed only when Ortensi accepts it, not on any reply; supplier questions go to a person',
      done: 'SOSPESO orders show up as held, not as “Order placed successfully”', links: [['Tool calls', t('agent_trace')]] },
    { id: 'webhooks', lane: 'pipes', start: '06-16', end: '06-16', owner: 'me', title: 'GLS notifies us of each scan (webhooks); Tina sends one email per step',
      done: 'Tina polling off (€575/month); no second “on its way”', links: [['mail_0017', t('ops_inbox', 'id', 'mail_0017')], ['Integrations', t('integrations')]] },
    { id: 'giada', lane: 'pipes', start: '06-16', end: '06-16', owner: 'supplier', title: 'Call Giada (20 min): set up the Ciabatta file exchange (SFTP)',
      done: 'CSV spec confirmed; test file accepted', links: [['mail_0005', t('ops_inbox', 'id', 'mail_0005')], ['Onboarding pack', '#/files']] },
    { id: 'hand-table', lane: 'queue', start: '06-16', end: '06-17', owner: 'code', title: 'Handoffs journal: one table + 3 agent tools (create, answer, pass)',
      done: 'Agents stop @mentioning each other; every “someone else must act” is a row with an owner', links: [['Handoffs', '#/handoffs']] },
    { id: 'hand-watch', lane: 'queue', start: '06-17', end: '06-18', owner: 'code', title: 'Who-owns-what table + automatic checker: owner, deadline, to a person when late',
      done: 'Repeats merge into one row; anything late lands with a human with the email and history attached', links: [['Who owns what', '#/handoffs']] },
    { id: 'hand-replay', lane: 'queue', start: '06-19', end: '06-19', owner: 'me', title: 'Test the journal on last week’s messages; switch off Nora’s hourly summary',
      done: 'Every handoff of the week has an owner; Nora’s hourly summary off (€126/month)', links: [['Test run', '#/handoffs'], ['Channels', t('agent_channel')]] },
    { id: 'paolo', lane: 'queue', start: '06-17', end: '06-26', owner: 'agent', title: 'Paolo: simple return refunds, one trial week where he only suggests, then pays on his own from 24 June',
      done: 'For one week his suggestions match my decisions 100%; then 60% of refunds run without a click', links: [['Refunds', t('payments', 'kind', 'refund')]] },
    { id: 'mia', lane: 'queue', start: '06-18', end: '06-24', owner: 'agent', title: 'Mia prompt v2: no discount nudge, no refund before scan, slim context',
      done: 'Passes the 30-case test (16 urgent + 14 rejected refunds); drafting cost halved', links: [['review_today', t('agent_actions', 'review_today', '1')]] },
    { id: 'csv', lane: 'pipes', start: '06-17', end: '06-23', owner: 'code', title: 'Ciabatta order CSV every 30 min; read stock and tracking files',
      done: 'Go live 23 June: 0 email orders, stock from Ciabatta’s daily file', links: [['Supplier orders', t('supplier_orders', 'status', 'EMAILED')]] },
    // ---- Week 2
    { id: 'sam', lane: 'pipes', start: '06-22', end: '06-22', owner: 'me', title: 'Sam back: hand-over, second Ortensi admin, what stays manual',
      done: 'Sam owns the list of what’s now code and how to switch it off', links: [] },
    { id: 'kade-auto', lane: 'money', start: '06-22', end: '06-26', owner: 'code', title: 'Kade-first runs unattended; only split orders come to a human',
      done: '25+ resale orders a week', links: [['Impact', '#/impact']] },
    { id: 'review', lane: 'all', start: '06-26', end: '06-26', owner: 'me', title: 'Day-14 review: the numbers below, with Sam and Elena',
      done: 'Each priority hit or a reason and a next step', links: [] },
  ];

  const SHORT = { 'kade-approve': 'Kade-first, approved daily', 'kade-auto': 'Kade-first unattended', exec: 'Code runs approvals', paolo: 'Paolo trial week', mia: 'Mia prompt v2', 'hand-table': 'Handoffs journal build', 'hand-watch': 'Handoffs checker', csv: 'Ciabatta SFTP build' };
  const OWNER = { me: 'Me', elena: 'Elena', code: 'Code', agent: 'Agent', supplier: 'Supplier' };

  views.plan = async page => {
    const [ov, integ, disp, kade, h, hd] = await Promise.all([
      api('/admin/overview'), api('/admin/integrations'), api('/payments/disputes?status=open'),
      api('/kade/stock?status=available'), fetch('impact-data.json').then(r => r.json()).catch(() => null),
      fetch('handoffs-data.json').then(r => r.json()).catch(() => null),
    ]);
    let done = load();
    const oldestH = ov.oldest_pending_at ? (SIM_NOW - Date.parse(ov.oldest_pending_at)) / 36e5 : 0;
    const feed = (integ.integrations || []).find(i => i.name === 'ortensi_stock_feed');
    const feedAgeH = feed?.last_success_at ? (SIM_NOW - Date.parse(feed.last_success_at)) / 36e5 : null;
    const openDisp = (disp.disputes || disp.items || disp).length ?? 0;
    const gradeA = (kade.units || kade.stock || kade.items || kade).filter?.(u => u.grade === 'A').length ?? 0;
    const agents = h ? Object.values(h.spend).reduce((a, s) => a + s.reduce((x, y) => x + y, 0), 0) : 1306;

    const TARGETS = {
      money: [
        ['Profit per pair kept (after ads)', '−€11.11', '≈ −€4', 'Impact tab, with real resale and dispute rates'],
        ['Kade resale orders a week', '0', '25+', 'kade_router.py plans approved'],
        ['“As new” returns waiting at Kade', String(gradeA), 'under 40', 'live: /kade/stock'],
        ['Open disputes (all delivered)', String(openDisp), '0 accepted', 'live: /payments/disputes'],
      ],
      queue: [
        ['Pending approvals', String(ov.pending_actions), 'under 30', 'live: /admin/overview'],
        ['Oldest pending', `${Math.round(oldestH)} h`, 'under 4 h at 09:00', 'live: /admin/overview'],
        ['Refunds without a human', '0%', '60%', 'Paolo after the trial week'],
        ['Double refunds', '2 in 30 days', '0', 'CC-11109, CC-10662'],
        ['Handoffs with no owner', hd ? String(hd.summary.open_now) : '16', '0', 'Handoffs tab: test on inbox + chat'],
        ['Time until a human has it', hd ? `${(hd.handoffs.map(r => r.open_h).sort((a, b) => a - b)[Math.floor(hd.handoffs.length / 2)] / 24).toFixed(1)} days` : '7 days', 'under 24 h', 'automatic checker on deadlines'],
      ],
      pipes: [
        ['Ortensi stock data age', feedAgeH == null ? '—' : `${Math.round(feedAgeH)} h`, 'under 3 h', 'live: integrations'],
        ['Ciabatta email orders a month', '650', '0', 'file exchange live on 23 June'],
        ['Agent spend a month', E0.format(agents), 'under €300', 'agent_runs'],
        ['Integrations with alerting', '1 of 10', '10 of 10', 'Handoffs checker'],
      ],
    };

    page.innerHTML = `<div class="impact plan">` + head('Plan', 'My first two weeks covering for Sam: Monday 15 to Friday 26 June. Three priorities, what happens when, and the numbers that show it worked by day 14. Tick items off as they’re done (kept in this browser).',
      '<button class="btn small" id="plan-reset">Clear ticks</button>') + `
      <div class="lanes3" id="lanes"></div>
      <div class="card" style="margin-top:16px"><h2>Timeline</h2><p class="sub">Week 1 puts out the fires and runs Kade-first with a human approving each plan. Week 2 switches the proven pieces to unattended. Hover a bar for what “done” means.</p>
        <div class="legend">${LANES.map(l => `<span><i style="background:${l.color}"></i>${l.n} · ${esc(l.name)}</span>`).join('')}<span><i style="background:var(--ink)"></i>Day-14 review</span></div>
        <div class="chart gantt" id="gantt"></div></div>
      <h2 class="sec-h">Day by day</h2>
      <div class="days" id="days"></div>
      <h2 class="sec-h">Day 14: the numbers, now vs. target</h2>
      <div class="grid three" id="targets"></div>
      <div class="card" style="margin-top:16px"><h2>Decisions that aren’t mine</h2>
        <ul class="plain">
          <li><span class="owner elena">Elena</span> Contest Ortensi’s +8% (12 days’ notice; the contract says 30): €3,528 billed so far.</li>
          <li><span class="owner elena">Elena</span> Pay Ortensi within 10 days for the 2% discount (~€2k a month); we sit at €98k of a €120k limit.</li>
          <li><span class="owner elena">Elena</span> Ask Ciabatta for credit on unsold returns (+€2.34 per kept pair), and align our 12-month defect promise with their 6.</li>
          <li><span class="owner elena">Elena</span> Paid ads on the Ciabatta lines, which lose money on every kept pair.</li>
        </ul>
        <p class="faint" style="margin:10px 0 0">Kept human on purpose: the makers’ relationships (Chiara’s weekly call, Giulia on defect claims) and the Positano strap injury case.</p></div>
    </div>`;
    const $ = s => page.querySelector(s);

    const laneDone = l => { const its = ITEMS.filter(i => i.lane === l); return [its.filter(i => done[i.id]).length, its.length]; };
    const drawLanes = () => {
      $('#lanes').innerHTML = LANES.map(l => {
        const [d, n] = laneDone(l.id);
        return `<div class="card lane" style="--lane:${l.color}"><span class="k">Priority ${l.n}</span><b>${esc(l.name)}</b><p>${esc(l.why)}</p>
          <div class="prog"><span style="width:${(d / n) * 100}%"></span></div><span class="faint">${d} of ${n} done</span></div>`;
      }).join('');
    };
    const day = s => Number(s.slice(3)), DAYS = [15, 16, 17, 18, 19, 22, 23, 24, 25, 26];
    const WD = { 15: 'Mon', 16: 'Tue', 17: 'Wed', 18: 'Thu', 19: 'Fri', 22: 'Mon', 23: 'Tue', 24: 'Wed', 25: 'Thu', 26: 'Fri' };
    const laneOf = id => LANES.find(l => l.id === id);
    const color = it => (it.lane === 'all' ? 'var(--ink)' : laneOf(it.lane).color);
    const drawGantt = () => {
      const order = [...LANES.map(l => l.id), 'all'];
      const rows = ITEMS.slice().sort((a, b) => order.indexOf(a.lane) - order.indexOf(b.lane) || day(a.start) - day(b.start) || day(a.end) - day(b.end));
      const W = 980, L = 360, R = 16, rowH = 24, T = 34, cols = DAYS.length, cw = (W - L - R) / cols;
      const xi = d => DAYS.indexOf(d), x = d => L + xi(d) * cw;
      let y = T, svg = '', prevLane = null;
      const pos = [];
      rows.forEach(it => {
        if (it.lane !== prevLane) { y += it.lane === 'all' ? 10 : 30; if (it.lane !== 'all') svg += `<text class="lanehead" x="8" y="${y - 14}">${esc(laneOf(it.lane).n + ' · ' + laneOf(it.lane).name.toUpperCase())}</text>`; prevLane = it.lane; }
        pos.push([it, y]); y += rowH;
      });
      const H = y + 8;
      let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Two-week plan timeline">`;
      DAYS.forEach((d, i) => {
        g += `<rect x="${L + i * cw}" y="${T - 8}" width="${cw}" height="${H - T}" fill="${i % 2 ? 'transparent' : 'rgba(30,26,22,0.025)'}"/>`;
        g += `<text class="lbl" x="${L + i * cw + cw / 2}" y="14" text-anchor="middle">${WD[d]}</text><text class="lbl" x="${L + i * cw + cw / 2}" y="27" text-anchor="middle" ${d === 15 ? 'font-weight="700" fill="var(--ink)"' : ''}>${d} Jun</text>`;
      });
      g += `<line x1="${L + 5 * cw}" x2="${L + 5 * cw}" y1="${T - 8}" y2="${H}" class="base" stroke-dasharray="3 3"/><text class="lbl" x="${L + 5 * cw + 4}" y="${H - 4}">Sam back</text>`;
      g += svg;
      pos.forEach(([it, yy]) => {
        const x0 = x(day(it.start)) + 4, x1 = x(day(it.end)) + cw - 4, c = color(it), ok = done[it.id];
        g += `<text class="rowname${ok ? ' ok' : ''}" x="20" y="${yy + 4}">${ok ? '✓ ' : ''}${esc(it.title.length > 52 ? it.title.slice(0, 51) + '…' : it.title)}</text>`;
        g += `<rect class="bar" data-id="${it.id}" x="${x0}" y="${yy - 7}" width="${Math.max(10, x1 - x0)}" height="14" rx="7" fill="${c}" fill-opacity="${ok ? 1 : 0.22}" stroke="${c}" stroke-width="1.25"/>`;
        g += `<rect class="hit" data-id="${it.id}" x="0" y="${yy - 12}" width="${W}" height="${rowH}"/>`;
      });
      g += `</svg><div class="tip" style="display:none"></div>`;
      $('#gantt').innerHTML = g;
      const el = $('#gantt'), svgEl = el.querySelector('svg'), tip = el.querySelector('.tip');
      svgEl.addEventListener('mousemove', e => {
        const hit = e.target.closest('[data-id]'); if (!hit) return;
        const it = ITEMS.find(i => i.id === hit.dataset.id), box = svgEl.getBoundingClientRect(), k = box.width / W;
        const yy = pos.find(p => p[0] === it)[1];
        tip.innerHTML = `<b>${esc(it.title)}</b><div class="r"><span>${WD[day(it.start)]} ${day(it.start)}${it.end !== it.start ? `–${WD[day(it.end)]} ${day(it.end)}` : ''} Jun</span><span>${OWNER[it.owner]}</span></div><div style="white-space:normal;max-width:300px;margin-top:4px">Done when: ${esc(it.done)}</div>`;
        tip.style.display = ''; tip.style.left = `${Math.min(Math.max(e.clientX - box.left, 170), box.width - 170)}px`; tip.style.top = `${(yy + 12) * k}px`;
      });
      svgEl.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svgEl.addEventListener('click', e => { const hit = e.target.closest('[data-id]'); if (hit) page.querySelector(`#it-${hit.dataset.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    };
    const drawDays = () => {
      const weeks = [['Week 1', [15, 16, 17, 18, 19]], ['Week 2', [22, 23, 24, 25, 26]]];
      $('#days').innerHTML = weeks.map(([wk, ds]) => `<div class="week"><h3>${wk}</h3>${ds.map(d => {
        const its = ITEMS.filter(i => day(i.start) === d);
        const cont = ITEMS.filter(i => day(i.start) < d && day(i.end) >= d);
        return `<div class="dayc card"><div class="dayh"><b>${WD[d]} ${d} June</b>${d === 15 ? '<span class="pill bad">Today · before 11:00 UTC</span>' : d === 22 ? '<span class="pill sea">Sam back</span>' : d === 26 ? '<span class="pill ok">Day-14 review</span>' : ''}</div>
          ${its.length ? '<div class="its">' + its.map(it => `<label class="item${done[it.id] ? ' done' : ''}" id="it-${it.id}" style="--lane:${color(it)}">
            <input type="checkbox" data-done="${it.id}" ${done[it.id] ? 'checked' : ''}>
            <span><b>${esc(it.title)}</b><small>Done when: ${esc(it.done)}${it.end !== it.start ? ` · runs to ${WD[day(it.end)]} ${day(it.end)}` : ''}</small>
              ${it.links.length ? `<span class="links">${it.links.map(([lab, href]) => `<a href="${href}">${esc(lab)}</a>`).join('')}</span>` : ''}</span>
            <span class="owner o-${it.owner}">${OWNER[it.owner]}</span></label>`).join('') + '</div>' : ''}
          ${cont.length ? `<p class="faint cont">Running: ${cont.map(i => esc(SHORT[i.id] || i.title)).join(' · ')}</p>` : ''}
          ${!its.length && !cont.length ? '<p class="faint cont">Buffer</p>' : ''}</div>`;
      }).join('')}</div>`).join('');
    };
    const drawTargets = () => {
      $('#targets').innerHTML = LANES.map(l => `<div class="card target" style="--lane:${l.color}"><h2>${l.n} · ${esc(l.name)}</h2>
        <table><thead><tr><th></th><th>Now</th><th>Day 14</th></tr></thead><tbody>${TARGETS[l.id].map(([k, now, tgt, src]) =>
          `<tr><td>${esc(k)}<small>${esc(src)}</small></td><td class="mono">${esc(now)}</td><td class="mono"><b>${esc(tgt)}</b></td></tr>`).join('')}</tbody></table></div>`).join('');
    };
    const drawAll = () => { drawLanes(); drawGantt(); drawDays(); drawTargets(); };
    page.addEventListener('change', e => {
      const id = e.target.dataset.done; if (!id) return;
      done = { ...done, [id]: e.target.checked }; if (!e.target.checked) delete done[id];
      save(done); drawLanes(); drawGantt(); e.target.closest('.item').classList.toggle('done', e.target.checked);
    });
    $('#plan-reset').addEventListener('click', () => { done = {}; save(done); drawAll(); });
    drawAll();
  };
})();
