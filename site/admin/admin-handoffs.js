// Ciabatta Club back office, Handoffs: a journal of "someone else has to do something", replayed on the case history.
// Every handoff has one owner (from a routing table in code), a due time, and a watchdog that escalates to a human.
// Data: handoffs-data.json, written by `python3 build/handoffs.py` from the ops inbox and the agents' channel.
(() => {
  const { views, esc, head } = CC;
  const OWN = { human: ['Ops (human)', 'o-me'], elena: ['Elena', 'o-elena'], leo: ['Leo', 'o-agent'], mia: ['Mia', 'o-agent'], paolo: ['Paolo', 'o-agent'] };
  const TOPIC = {
    credentials: 'Credentials', supplier_payment: 'Supplier payment', commercial: 'Prices & terms', held_orders: 'Held orders',
    order_ops: 'Supplier order', customer_notice: 'Tell customers', dispute: 'Dispute', returns_stock: 'Kade stock',
    returns_backlog: 'Kade scans', integration: 'Integration', tracking_gap: 'Tracking gap', approval_queue: 'Approval queue',
  };
  const TITLE = {
    'credentials:mail_0002': 'Ciabatta file-exchange (SFTP) login arrives', 'commercial:ortensi-prices': 'Ortensi: +8% from 1 June',
    'integration:ciabatta-sftp': 'Ciabatta: please send orders as files (SFTP)', 'customer_notice:ortensi-closure': 'Ortensi closed 11–12 June',
    'held_orders:POR-SND-38': 'Ortensi: 4 orders wait for Portofino Sabbia 38', 'supplier_payment:ciabatta-invoices': 'Ciabatta invoices overdue → credit hold',
    'returns_backlog:kade-scans': 'Returns at Kade not scanned', 'returns_stock:kade-ageing': 'Kade: 46 pairs older than 45 days',
    'dispute:PP-D-22918461': 'PayPal dispute on CC-11202 (€139)', 'credentials:mail_0016': 'Ortensi access key expires 12 June',
    'integration:gls-webhooks': 'GLS offers to notify us of each scan (webhooks)', 'tracking_gap:no-tracking': 'Orders without tracking after 24 h',
    'order_ops:ORT-26-33678': 'ORT-26-33678: cancel or ship?', 'held_orders:ciabatta-oos': 'Ciabatta: 17 orders held, 4 products out of stock',
    'held_orders:CAP-BLK-42-43': 'Ortensi: Capri Nero 42/43 sold out', 'approval_queue:queue': 'Approvals waiting for Sam',
  };
  const when = s => `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;
  const dur = h => (h < 1 ? 'at once' : h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(h < 240 ? 1 : 0)} days`);
  const srcLink = e => (e.kind === 'email' ? `<a class="mono lk" href="#/t/ops_inbox?col=id&val=${e.src}">${e.src}</a>`
    : e.kind === 'sent' ? `<a class="mono lk" href="#/t/ops_inbox?col=id&val=${e.src}">${e.src}</a>`
      : `<a class="mono lk" href="#/t/agent_channel?col=ts&val=${encodeURIComponent(e.at)}">${esc(e.who)} ${when(e.at)}</a>`);

  views.handoffs = async page => {
    const d = await fetch('handoffs-data.json').then(r => r.json());
    const H = d.handoffs, s = d.summary;
    const tina = H.find(r => r.about === 'no-tracking');
    const medDays = H.map(r => r.open_h).sort((a, b) => a - b)[Math.floor(H.length / 2)] / 24;
    const humanNow = H.filter(r => r.owner === 'human' || r.owner === 'elena').length;

    page.innerHTML = `<div class="impact plan hand">` + head('Handoffs', 'A journal for every “someone else has to do something”, tested on the case history. Code picks who owns each item, merges repeats into one line, and an automatic checker hands anything late to a human with the evidence attached.') + `
      <div class="tiles">
        <div class="tile"><span class="k">Handoffs in the history</span><div class="vals"><span>Rows</span><b class="plan">${H.length}</b></div><span class="note">from ${d.messages} supplier emails and agent posts</span></div>
        <div class="tile"><span class="k">Open this morning, no owner</span><div class="vals"><span>As is</span><b class="plan">${s.open_now} of ${H.length}</b></div><span class="note">every one ended in “noted”, “skipped” or a task nobody holds</span></div>
        <div class="tile"><span class="k">Time until a human has it</span><div class="vals"><span><i style="background:#C2552B"></i>As is</span><b>${medDays.toFixed(1)} days</b><span><i style="background:#1A73A8"></i>Journal</span><b class="plan">≤ 24 h</b></div><span class="note">median open time today vs. the slowest due time (disputes: 48 h before the deadline)</span></div>
        <div class="tile"><span class="k">Chat noise removed</span><div class="vals"><span>Posts</span><b class="plan">${d.noise.digest + tina.repeats - 1}</b></div><span class="note">${d.noise.digest} Nora summaries + ${tina.repeats} identical Tina asks → 1 row with a counter</span></div>
      </div>
      <div class="card" style="margin-top:16px"><h2>How the journal works</h2>
        <div class="flow hflow">
          <div class="step"><b>1 · Route</b><small>A supplier email or an agent’s question becomes a row. A who-owns-what table (in code) sets the topic and the owner, so agents can’t bounce it.</small></div>
          <div class="step"><b>2 · Merge</b><small>The same topic about the same order or supplier while open = the same row; a counter goes up instead of a new message.</small></div>
          <div class="step"><b>3 · Answer or pass</b><small>The owner answers with a result or passes it with a reason, only where the table allows. “Noted” is not an answer.</small></div>
          <div class="step"><b>4 · Automatic checker</b><small>Every 15 min, code checks due times. Late = escalated to a human with the email, the order and the history attached.</small></div>
          <div class="step"><b>5 · Memory</b><small>Each agent run starts with its own open rows, so “I was asked this already” survives between runs.</small></div>
        </div></div>
      <div class="card" style="margin-top:16px"><h2>Time until a human has it: as is vs. with the journal</h2>
        <p class="sub">Each row is one handoff. Orange: open as of Monday 08:30 with nobody on it. Blue: when the journal would have put it in front of a human.</p>
        <div class="legend"><span><i style="background:#C2552B"></i>As is (still open)</span><span><i style="background:#1A73A8"></i>With the journal</span></div>
        <div class="hbars" id="hbars"></div></div>
      <h2 class="sec-h">The journal, tested on real history</h2>
      <div class="hlist" id="hlist"></div>
      <div class="grid two" style="margin-top:16px">
        <div class="card"><h2>Who owns what (decided by code, not the agent)</h2><table class="rt"><thead><tr><th>Topic</th><th>Owner</th><th>Due</th></tr></thead><tbody>${
          Object.entries(d.routes).map(([k, r]) => `<tr><td><b>${esc(TOPIC[k])}</b><small>${esc(r.why)}</small></td><td><span class="owner ${OWN[r.owner][1]}">${OWN[r.owner][0]}</span></td><td class="mono">${k === 'dispute' ? '48 h before deadline' : `${r.sla_h} h`}</td></tr>`).join('')}</tbody></table></div>
        <div class="card"><h2>What the agents get instead of @mentions</h2>
          <pre class="args">handoff_create(topic, about, question)
  → code routes it; returns the row and its owner

handoff_answer(id, result)
  → result = what was done or decided;
    "noted" / "will check" is refused

handoff_pass(id, reason)
  → only to the owner the table allows;
    otherwise the checker takes it

Every run starts with:
  my_open_handoffs()  → id, about, due, history</pre>
          <p class="faint" style="margin:10px 0 0;font-size:13px">One table in the database (<span class="mono">handoffs</span>: id, topic, about, owner, due, status, history). The chat stays, for people to read.</p></div>
      </div></div>`;
    const $ = q => page.querySelector(q);

    // bars: days until a human has it, as is vs journal
    const rows = H.slice().sort((a, b) => b.open_h - a.open_h);
    const max = Math.max(...rows.map(r => r.open_h));
    const pct = h => `${Math.max(0.6, (h / max) * 100)}%`;
    $('#hbars').innerHTML = rows.map(r => `<div class="hb">
      <span class="hb__k">${esc(TITLE[r.key] || r.key)}</span>
      <span class="hb__t"><span class="b asis" style="width:${pct(r.open_h)}"></span><span class="b jr" style="width:${pct(r.to_human_h)}"></span></span>
      <span class="hb__v mono">${dur(r.open_h)} <span class="faint">→ ${r.topic === 'dispute' ? `by ${when(r.human_by).slice(0, 5)}` : r.to_human_h < 1 ? 'at once' : dur(r.to_human_h)}</span></span></div>`).join('');

    // the journal: one card per handoff
    $('#hlist').innerHTML = H.slice().reverse().map(r => `<div class="card hcard">
      <div class="hcard__top"><span class="pill">${esc(TOPIC[r.topic])}</span><b>${esc(TITLE[r.key] || r.key)}</b>
        <span class="owner ${OWN[r.owner][1]}">${OWN[r.owner][0]}</span></div>
      <div class="hcard__meta mono">opened ${when(r.created)} · due ${r.topic === 'dispute' ? when(r.due) : (r.sla_h ? `${r.sla_h} h` : 'now')} · ${r.repeats > 1 ? `<b>×${r.repeats}</b> messages merged` : '1 message'}</div>
      <div class="hcard__cols">
        <div class="col asis"><span class="lab">As is</span><p>${esc(r.as_is)}</p><p class="cost">${esc(r.consequence)}</p><span class="mono faint">open ${dur(r.open_h)}</span></div>
        <div class="col jr"><span class="lab">With the journal</span><p>${r.owner === 'human' || r.owner === 'elena'
          ? `Routed to ${OWN[r.owner][0]} when it arrived (${when(r.created)}), due in ${r.sla_h} h. Overdue → back on top of the human list with the email attached.`
          : `${OWN[r.owner][0]} owns it until ${when(r.human_by)}. No result by then → the automatic checker hands it to a person with the history.`}</p>
          <span class="mono faint">human has it ${r.topic === 'dispute' ? `by ${when(r.human_by)}, 2 days before the deadline` : r.to_human_h < 1 ? 'at once' : `within ${dur(r.to_human_h)}`}</span></div>
      </div>
      <div class="hcard__src">${r.events.slice(0, 8).map(srcLink).join(' ')}${r.events.length > 8 ? ` <span class="faint">+${r.events.length - 8} more</span>` : ''}</div>
    </div>`).join('');
  };
})();
