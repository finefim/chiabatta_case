// Ciabatta Club back office: shell, a generic table browser, agents and files.
// Supplies (terms and unit economics) lives in admin-economics.js and registers itself on CC.views.
(() => {
  const SIM_NOW = Date.parse('2026-06-15T06:30:00Z');
  const $ = (s, el = document) => el.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = v => (v == null || v === '' ? '—' : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Math.round(Number(v) * 100) / 100 || 0));
  const toast = text => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; document.body.append(t); setTimeout(() => t.remove(), 3200); };
  const head = (title, sub = '', right = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json' } });
    if (res.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.hash)}`; throw new Error('Logged out'); }
    const body = await res.json();
    if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { body, status: res.status });
    return body;
  }

  // ---------- copying, Sam's note and the agent brief ----------
  const BOOKING_URL = 'https://calendar.app.google/mnerFB29rKx3UY378';
  let me = { user: null, hosted: false };
  const copyLater = (text, done) => navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then(t => new Blob([t], { type: 'text/plain' })) })])
    .then(() => Promise.resolve(done)).then(toast, e => toast(`Couldn’t copy: ${e.message}`));
  const mdTable = (cols, rows) => [cols, cols.map(() => '---'), ...rows.map(r => cols.map(c => r[c]))]
    .map(l => `| ${l.map(v => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ')} |`).join('\n');
  const zipCmd = (auth = me.user) => `curl -fu ${auth} -o case.zip ${location.origin}/files/ciabatta-ops-case.zip && unzip -q case.zip && cd ciabatta-ops-case && node api/server.mjs`;
  function agentBrief() {
    const o = location.origin;
    return ['# Ciabatta Club: AI Operations case', '',
      'I\'m doing a hiring case for an AI Operations role and you\'re helping me. Keep the decisions mine: suggest, build and test, and write down what you assume.', '',
      `1. Read Sam's note first. It explains how the business runs and what's asked: ${me.hosted ? `${o}/files/note-from-sam.md` : '`note-from-sam.md` in the case folder'}`,
      me.hosted ? `2. Get everything locally (the data as SQLite and CSV, docs, the agents' prompts, the inbox and logs). This needs my password: ask me to set it with \`export CASE_PASSWORD=...\` in your shell (never write it into a file), then run:\n\n\`\`\`bash\n${zipCmd(`"${me.user}:$CASE_PASSWORD"`)}\n\`\`\`\n`
        : '2. Everything is in the case folder: `data/` (SQLite and CSV), `docs/`, `agents/`, `inbox/`, `logs/`. `README.md` explains the layout.',
      `3. Or query the back office API, which includes my own changes: \`GET ${o}/admin/tables\` lists the tables, \`GET ${o}/admin/tables/<name>?q=&col=&val=&limit=500\` returns rows, and \`&format=csv\` returns the whole table as CSV. The mock supplier, carrier, returns, payment and helpdesk APIs are described in \`docs/api.md\`.`,
      ...(me.hosted ? ['', `Auth: HTTP basic auth with my login, ${me.user}, and the password in $CASE_PASSWORD. Never write the password into a file.`] : []), '',
      'The clock is frozen at Monday 15 June 2026, 08:30 in Italy. Everything is invented and nothing is really sent.'].join('\n');
  }
  const briefAgent = () => copyLater(Promise.resolve(agentBrief()), 'Copied. Paste it into Claude Code, Codex or Cursor.');
  const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  function md(text) {
    const out = [], lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^#{1,3} /.test(l)) { const h = l.match(/^#+/)[0].length; out.push(`<h${h}>${inline(l.slice(h + 1))}</h${h}>`); i++; continue; }
      if (/^> /.test(l)) { const q = []; while (i < lines.length && /^> ?/.test(lines[i])) q.push(lines[i++].replace(/^> ?/, '')); out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`); continue; }
      if (/^(\d+\.|-) /.test(l)) {
        const ordered = /^\d/.test(l), start = parseInt(l, 10), items = [];
        while (i < lines.length && (/^(\d+\.|-) /.test(lines[i]) || /^ {2,}\S/.test(lines[i]) || (!lines[i].trim() && /^ {2,}\S/.test(lines[i + 1] || '')))) {
          const x = lines[i++];
          if (/^(\d+\.|-) /.test(x)) items.push({ head: x.replace(/^(\d+\.|-) /, ''), sub: [], more: [] });
          else if (/^ +- /.test(x)) items.at(-1).sub.push(x.trim().slice(2));
          else if (x.trim()) items.at(-1).more.push(x.trim());
        }
        out.push(`<${ordered ? `ol start="${start}"` : 'ul'}>${items.map(it => `<li>${inline(it.head)}${it.sub.length ? `<ul>${it.sub.map(x => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}${it.more.length ? `<p>${inline(it.more.join(' '))}</p>` : ''}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#|>|\d+\. |- )/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return out.join('\n');
  }

  // ---------- tables ----------
  // Areas follow the operation: your work, then an order's life (customer, order, supplier, return), then the agents.
  const NAV = [
    ['Plan', [['@approach', 'Efim’s approach'], ['@impact', 'Impact: as is vs. plan'], ['@plan', 'Two-week plan'], ['@handoffs', 'Handoffs journal']]],
    ['Your work', [['tasks', 'Tasks'], ['task_steps', 'Task steps'], ['agent_actions', 'Approvals'], ['ops_inbox', 'Inbox']]],
    ['Customers', [['conversations', 'Conversations'], ['customer_messages', 'Messages'], ['reviews', 'Reviews']]],
    ['Orders', [['orders', 'Orders'], ['order_lines', 'Order lines'], ['payments', 'Payments'], ['disputes', 'Disputes']]],
    ['Suppliers', [['@supplies', 'Supplies'], ['products', 'Products'], ['supplier_orders', 'Supplier orders'], ['tracking_events', 'Tracking'], ['supplier_invoices', 'Invoices'], ['supplier_invoice_lines', 'Invoice lines']]],
    ['Returns', [['returns', 'Returns'], ['kade_stock', 'Kade stock']]],
    ['Agents', [['@agents', 'Agents'], ['agent_channel', 'Channels'], ['agent_trace', 'Tool calls (72 h)'], ['agent_runs', 'Runs'], ['integrations', 'Integrations']]],
    ['Files', [['@files', 'Case files']]],
  ];
  const LABEL = Object.fromEntries(NAV.flatMap(g => g[1]).filter(([k]) => !k.startsWith('@')));
  const INFO = {
    tasks: 'Everything Sam did by hand, one row per task. Titles and tags are Sam’s own.', task_steps: 'Each step of each task: who did what, in which system, and how long it took.',
    agent_actions: 'Every action an agent proposed, and what a human decided. Pending ones wait for you.', ops_inbox: 'Email to ops@: suppliers, Kade, payment providers and the odd lead. Customers write in Conversations.',
    conversations: 'One row per customer thread, by chat or email. Mia drafts the replies.', customer_messages: 'Every message in those threads, plus the order emails Tina sends (last 14 days).',
    reviews: 'Product reviews on the shop.', orders: 'Every shop order in the last 30 days. Open one to see its story across every table.', order_lines: 'One row per pair or pack in an order.',
    payments: 'Charges and refunds, in each provider’s own status words.', disputes: 'Card and PayPal disputes.',
    products: 'One row per SKU: our price, the maker’s cost and the stock we last heard about.', supplier_orders: 'Each order as the supplier sees it, in the supplier’s own status words.',
    tracking_events: 'Carrier scans: GLS deliveries to customers and DHL returns to Kade.', supplier_invoices: 'Invoices from Ortensi and Ciabatta.', supplier_invoice_lines: 'Each invoice line, per supplier order.',
    returns: 'Return requests, the parcel back to Kade and Kade’s grade.', kade_stock: 'Returned pairs on Kade’s shelves in Venlo.',
    agent_channel: 'What the agents posted to each other.', agent_trace: 'The agents’ tool calls over the last 72 hours.', agent_runs: 'Every agent run: task, model, tokens and cost.', integrations: 'Feeds and APIs, with their last run and errors.',
  };
  const ROLE = { mia: 'Customer chat', leo: 'Suppliers', tina: 'Tracking', paolo: 'Money', nora: 'Coordination' };
  const LINK = { order_id: 'orders', customer_id: 'orders', conversation_id: 'conversations', supplier_order_id: 'supplier_orders', return_id: 'returns', task_id: 'tasks',
    invoice_id: 'supplier_invoices', sku: 'products', action_id: 'agent_actions', dispute_id: 'disputes', review_id: 'reviews', unit_id: 'kade_stock', run_id: 'agent_runs' };
  const MENTIONS = [
    [/\bCC-\d{5}\b/g, 'orders', 'order_id'], [/\b(?:ORT-\d{2}-\d{5}|CB-\d{5})\b/g, 'supplier_orders', 'supplier_order_id'], [/\bKR-\d{5}\b/g, 'returns', 'return_id'],
    [/\bKU-\d{4}\b/g, 'kade_stock', 'unit_id'], [/\bconv_\d{5}\b/g, 'conversations', 'conversation_id'], [/\bact_\d{6}\b/g, 'agent_actions', 'action_id'], [/\bT-\d{4}\b/g, 'tasks', 'task_id'],
    [/\b(?:FT-\d{4}\/\d{4}|CB-INV-\d{4})\b/g, 'supplier_invoices', 'invoice_id'], [/\b(?:PP-D-\d{8}|dp_[a-z0-9]{16})\b/g, 'disputes', 'dispute_id'], [/\bRV-\d{4}\b/g, 'reviews', 'review_id'],
    [/\bmail_\d{4}\b/g, 'ops_inbox', 'id'], [/\b(?:GLS\d{11}|JJD\d{18})\b/g, 'tracking_events', 'tracking_number'], [/\b(?:ULT|LOF|SOX|CAP|AMA|POS|ISC|POR)-[A-Z]{3}-\d{2}\b/g, 'products', 'sku'],
  ];
  const linkify = html => MENTIONS.reduce((h, [re, t, c]) => h.replace(re, id => `<a class="mono lk" href="#/t/${t}?col=${c}&val=${encodeURIComponent(id)}">${id}</a>`), html);
  const PILLS = {
    ok: ['SPEDITO', 'SHIPPED', 'delivered', 'succeeded', 'completed', 'paid', 'approved', 'ok', 'closed', 'sold', 'won', 'A', 'CONFIRMED'],
    warn: ['RICEVUTO', 'IN_LAVORAZIONE', 'EMAILED', 'pending', 'open', 'shipped', 'awaiting_supplier', 'waiting_on_customer', 'edited', 'to_ortensi', 'held_for_claim', 'B', 'credited', 'awaiting_approval', 'unassigned'],
    bad: ['SOSPESO', 'OUT_OF_STOCK', 'failing', 'rejected', 'overdue', 'lost', 'written_off', 'C', 'accepted'],
    sea: ['ANNULLATO', 'CANCELLED', 'cancelled', 'available'],
  };
  const PILL_COLS = /^(status|grade|outcome|kind|decision|template)$/;
  const cell = (col, v, table, pk) => {
    if (v == null || v === '') return '<span class="faint">—</span>';
    const s = String(v);
    if (LINK[col] && (LINK[col] !== table || col === 'customer_id') && !s.includes(' ')) return `<a class="mono lk" href="#/t/${LINK[col]}?col=${col === 'sku' ? 'sku' : col}&val=${encodeURIComponent(s)}">${esc(s)}</a>`;
    if (PILL_COLS.test(col)) { const k = Object.keys(PILLS).find(k => PILLS[k].includes(s)); return `<span class="pill ${k || ''}">${esc(s.replace(/_/g, ' '))}</span>`; }
    if (/_eur$/.test(col)) return `<span class="num">${esc(Number(s).toFixed(2))}</span>`;
    if (/(_at|^at|^ts|_time)$/.test(col) && /^\d{4}-\d\d-\d\dT/.test(s)) return `<span class="mono">${esc(s.slice(0, 16).replace('T', ' '))}</span>`;
    const text = esc(s.length > 140 ? `${s.slice(0, 140)}…` : s);
    return pk ? text : linkify(text);
  };

  async function tableView(page, params, name) {
    const q = params.get('q') || '', col = params.get('col') || '', val = params.get('val') || '';
    const sort = params.get('sort') || '', dir = params.get('dir') || 'asc', offset = Number(params.get('offset') || 0);
    const qs = new URLSearchParams({ q, col, val, sort, dir, offset, limit: 50 });
    const data = await api(`/admin/tables/${name}?${qs}`);
    const nav = (patch) => { const p = new URLSearchParams({ q, col, val, sort, dir, offset: 0, ...patch }); for (const [k, v] of [...p]) if (!v || v === '0') p.delete(k); location.hash = `#/t/${name}?${p}`; };
    const label = NAV.flatMap(g => g[1]).find(([k]) => k === name)?.[1] || name;
    const csvQs = new URLSearchParams({ q, col, val, sort, dir: sort ? dir : '', format: 'csv' });
    for (const [k, v] of [...csvQs]) if (!v) csvQs.delete(k);
    page.innerHTML = head(label, `${esc(INFO[name] || '')} <span class="faint mono">${esc(name)} · ${data.total.toLocaleString('en')} rows</span>`,
      `<div class="head-actions"><button class="btn small" id="copymd">Copy as markdown</button><a class="btn small" href="/admin/tables/${name}?${csvQs}" download>Download CSV</a></div>`) + `
      <form class="toolbar" id="tf"><input class="input" name="q" value="${esc(q)}" placeholder="Search every column" aria-label="Search">
        <button class="btn small">Search</button>${q ? '<button class="btn small ghost" type="button" id="clearq">Clear search</button>' : ''}
        ${col ? `<span class="chip on">${esc(col)} = ${esc(val)} <a href="#" id="clear" aria-label="Clear filter" style="margin-left:6px;text-decoration:none">×</a></span>` : ''}</form>
      <div class="table-wrap grid-wrap"><table class="dtable"><thead><tr>${data.columns.map(c => `<th data-c="${esc(c)}" class="sortable" tabindex="0" aria-sort="${sort === c ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(c)}${sort === c ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
        <tbody>${data.rows.map((r, i) => `<tr class="click" tabindex="0" data-i="${i}">${data.columns.map((c, k) => `<td>${cell(c, r[c], name, k === 0)}</td>`).join('')}</tr>`).join('') || `<tr><td class="empty" colspan="${data.columns.length}">No rows.</td></tr>`}</tbody></table></div>
      <div class="pager"><span class="faint">${data.total ? `${offset + 1}–${Math.min(offset + 50, data.total)} of ${data.total.toLocaleString('en')}` : ''}</span>
        <button class="btn small" id="prev" ${offset ? '' : 'disabled'}>Previous</button><button class="btn small" id="next" ${offset + 50 < data.total ? '' : 'disabled'}>Next</button></div>
      <aside class="drawer" id="drawer" hidden></aside>`;
    $('#copymd', page).addEventListener('click', () => {
      const rows = api(`/admin/tables/${name}?${new URLSearchParams({ q, col, val, sort, dir, limit: 500 })}`);
      copyLater(rows.then(d => mdTable(d.columns, d.rows)), rows.then(d => (d.total > d.rows.length
        ? `Copied the first ${d.rows.length} of ${d.total.toLocaleString('en')} rows. Download the CSV for all of them.` : `Copied ${d.total.toLocaleString('en')} rows as markdown.`)));
    });
    $('#tf', page).addEventListener('submit', e => { e.preventDefault(); nav({ q: new FormData(e.target).get('q') }); });
    $('#clear', page)?.addEventListener('click', e => { e.preventDefault(); nav({ col: '', val: '' }); });
    $('#clearq', page)?.addEventListener('click', () => nav({ q: '' }));
    const keyed = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } };
    page.querySelectorAll('th.sortable').forEach(th => { const go = () => nav({ sort: th.dataset.c, dir: sort === th.dataset.c && dir === 'asc' ? 'desc' : 'asc' }); th.addEventListener('click', go); th.addEventListener('keydown', keyed(go)); });
    $('#prev', page).addEventListener('click', () => nav({ offset: Math.max(0, offset - 50) }));
    $('#next', page).addEventListener('click', () => nav({ offset: offset + 50 }));
    page.querySelectorAll('tr.click').forEach(tr => { const go = e => { if (!e.target.closest('a')) openRow(page, name, data.columns, data.rows[tr.dataset.i]); }; tr.addEventListener('click', go); tr.addEventListener('keydown', e => { if (e.target === tr) keyed(go)(e); }); });
  }

  async function openRow(page, name, columns, row) {
    const d = $('#drawer', page);
    d.hidden = false;
    scrim(() => { d.hidden = true; });
    const own = String(row[columns[0]] ?? '');
    const mentioned = [...new Map(MENTIONS.flatMap(([re, t, c]) => columns.slice(1).flatMap(k => String(row[k] ?? '').match(re) || []).filter(v => v !== own).map(v => [`${t}:${v}`, { t, c, v }]))).values()];
    const storyOf = row.order_id || mentioned.find(m => m.t === 'orders')?.v;
    d.innerHTML = `<div class="drawer-head"><b>${esc(LABEL[name] || name)}</b><button class="btn small ghost" id="dx" aria-label="Close">Close</button></div>
      <dl class="kv">${columns.map(c => `<dt>${esc(c)}</dt><dd>${row[c] == null ? '<span class="faint">—</span>' : LINK[c] ? cell(c, row[c]) : /^\d{4}-\d\d-\d\dT[\d:]+Z$/.test(row[c]) ? `<span class="mono">${esc(row[c].slice(0, 16).replace('T', ' '))} UTC</span>` : `<span class="pre">${c === columns[0] ? esc(row[c]) : linkify(esc(row[c]))}</span>`}</dd>`).join('')}</dl>
      ${storyOf ? `<h3 class="rel-h">The story of ${esc(storyOf)}</h3><ol class="story" id="story"><li class="faint">Putting it together…</li></ol>` : ''}
      <h3 class="rel-h">Related</h3><div id="rel" class="faint">Looking…</div>`;
    $('#dx', d).addEventListener('click', closeScrim);
    $('#dx', d).focus();
    if (storyOf) orderStory(storyOf).then(html => { if ($('#story', d)) $('#story', d).innerHTML = html; });
    const keys = columns.filter(c => LINK[c] && row[c]);
    const { related } = await api(`/admin/related?keys=${keys.map(k => `${k}:${encodeURIComponent(encodeURIComponent(row[k]))}`).join(',')}&skip=${name}.${columns[0]}`);
    const found = [...related.map(r => ({ t: r.table, k: r.col, v: r.val, n: r.rows })), ...mentioned.filter(m => !related.some(r => r.table === m.t && r.val === m.v)).map(m => ({ t: m.t, k: m.c, v: m.v, n: 'mentioned' }))];
    $('#rel', d).innerHTML = found.map(p => `<a class="rel" href="#/t/${p.t}?col=${p.k}&val=${encodeURIComponent(p.v)}"><span>${esc(LABEL[p.t] || p.t)}</span><span class="mono">${esc(p.k)} = ${esc(p.v)}</span><b>${p.n}</b></a>`).join('') || 'Nothing linked.';
  }

  // One order's life across every table, in time order: the operational story behind the rows.
  async function orderStory(id) {
    const o = await api(`/admin/orders/${encodeURIComponent(id)}`).catch(() => null);
    if (!o) return '<li class="faint">No order found.</li>';
    const ev = [], words = s => String(s || '').replace(/_/g, ' ').toLowerCase();
    const add = (at, area, text, href) => { if (at) ev.push({ at, area, text, href }); };
    const t = (table, col, val) => `#/t/${table}?col=${col}&val=${encodeURIComponent(val)}`;
    add(o.created_at, 'orders', `Order placed: ${o.lines.length} line${o.lines.length > 1 ? 's' : ''}, ${eur(o.total_eur)} by ${o.payment_provider}`, t('orders', 'order_id', o.order_id));
    const so = o.supplier_order;
    if (so) {
      add(so.submitted_at, 'suppliers', `Sent to ${so.supplier} as ${so.supplier_order_id}`, t('supplier_orders', 'supplier_order_id', so.supplier_order_id));
      add(so.processing_at, 'suppliers', `${so.supplier} started on it`, t('supplier_orders', 'supplier_order_id', so.supplier_order_id));
      if (['SOSPESO', 'OUT_OF_STOCK', 'ANNULLATO', 'CANCELLED'].includes(so.status)) add(so.status_updated_at, 'suppliers', `${so.supplier} says ${so.status}${so.supplier_note ? `: ${so.supplier_note}` : ''}`, t('supplier_orders', 'supplier_order_id', so.supplier_order_id));
      add(so.shipped_at, 'suppliers', `Shipped with ${so.carrier || 'the carrier'} ${so.tracking_number || ''}`, t('tracking_events', 'tracking_number', so.tracking_number || ''));
    }
    for (const e of o.tracking) if (['DELIVERED', 'DELIVERY_FAILED', 'COLLECTED', 'ACCEPTED'].includes(e.status))
      add(e.event_time, e.direction === 'return' ? 'returns' : 'suppliers', `${e.carrier}: ${words(e.status)}${e.direction === 'return' ? ' (return to Kade)' : ''}${e.location ? `, ${e.location}` : ''}`, t('tracking_events', 'tracking_number', e.tracking_number));
    for (const m of o.messages.filter(x => !x.conversation_id)) add(m.sent_at, 'customers', `Tina emailed “${words(m.template)}”`, t('customer_messages', 'message_id', m.message_id));
    for (const c of o.conversations) add(c.opened_at, 'customers', `Customer wrote (${c.channel}): ${words(c.topic)}`, t('conversations', 'conversation_id', c.conversation_id));
    for (const a of o.actions) add(a.created_at, 'agents', `${a.agent[0].toUpperCase() + a.agent.slice(1)} proposed ${words(a.tool)}: ${a.status}`, t('agent_actions', 'action_id', a.action_id));
    for (const r of o.returns) {
      add(r.requested_at, 'returns', `Return ${r.return_id} requested: ${words(r.reason)}${r.reason_detail ? `, “${r.reason_detail}”` : ''}`, t('returns', 'return_id', r.return_id));
      add(r.kade_received_at, 'returns', `Kade checked it: grade ${r.grade || '?'}`, t('kade_stock', 'return_id', r.return_id));
    }
    for (const p of o.payments) add(p.created_at, 'money', `${p.kind === 'refund' ? 'Refund' : 'Payment'} ${eur(p.amount_eur)}, ${words(p.status)}${p.kind === 'refund' && p.created_by ? `, by ${p.created_by}` : ''}`, t('payments', 'payment_id', p.payment_id));
    for (const x of o.disputes) add(x.opened_at, 'money', `Dispute: ${words(x.reason)}, ${words(x.status)}`, t('disputes', 'dispute_id', x.dispute_id));
    for (const l of o.invoice_lines) add(l.invoice_date && `${l.invoice_date}T12:00:00Z`, 'suppliers', `Billed on ${l.invoice_id}: ${eur(l.amount_eur)}`, t('supplier_invoice_lines', 'order_id', o.order_id));
    for (const k of o.tasks) add(k.opened_at, 'work', `Sam’s task ${k.task_id}: ${k.title}`, t('tasks', 'task_id', k.task_id));
    for (const m of o.inbox) add(m.received_at, 'work', `Email: ${m.subject}`, t('ops_inbox', 'id', m.id));
    for (const p of o.channel) add(p.ts, 'agents', `${p.user} in ${p.channel}: ${p.text.length > 90 ? `${p.text.slice(0, 90)}…` : p.text}`, `#/t/agent_channel?q=${encodeURIComponent(o.order_id)}`);
    for (const r of o.reviews) add(r.created_at, 'customers', `Review, ${r.rating}★: ${r.title}`, t('reviews', 'review_id', r.review_id));
    ev.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return ev.map((e, i) => `<li class="story__${e.area}" style="--i:${i}"><time>${esc(String(e.at).slice(0, 16).replace('T', ' '))}</time><a href="${e.href}">${esc(e.text)}</a></li>`).join('');
  }

  // ---------- other views ----------
  const views = {};
  views.home = async page => {
    const [{ tables }, o, note] = await Promise.all([api('/admin/tables'), api('/admin/overview'), fetch('/files/note-from-sam.md').then(r => (r.ok ? r.text() : ''))]);
    const n = t => (tables.find(x => x.name === t)?.rows ?? 0).toLocaleString('en');
    const arriving = !sessionStorage.getItem('cc_desk');
    sessionStorage.setItem('cc_desk', '1');
    const item = (i, r) => `style="--i:${i};--r:${r}deg"`;
    const line = (label, value, href) => `<a href="${href}"><span>${label}</span><span>${value}</span></a>`;
    page.innerHTML = head('Morning!', 'Monday 15 June 2026, 08:30 in Italy. Sam is away until the 22nd and left the desk as it was.') + `
      <div class="desk${arriving ? ' is-arriving' : ''}">
        <article class="desk-item paper" ${item(0, -0.4)}><span class="tape" aria-hidden="true"></span>${md(note)}</article>
        <div class="desk__side">
          <div class="stickies span2">
            <a class="desk-item sticky sticky--yellow" ${item(1, -2.4)} href="#/t/tasks">Start with my tasks. It’s everything I did by hand.<b>${n('tasks')} tasks</b></a>
            <a class="desk-item sticky sticky--pink" ${item(2, 2)} href="#/t/ops_inbox">The inbox. I didn’t get to all of it.<b>${n('ops_inbox')} emails</b></a>
            <a class="desk-item sticky sticky--blue" ${item(3, 1.4)} href="#/t/agent_channel">The agents talk to each other in their channels. Worth a scroll.<b>${n('agent_channel')} posts</b></a>
            <a class="desk-item sticky sticky--green" ${item(4, -1.8)} href="#/t/agent_actions?col=review_today&val=1">Mia flagged these for Monday morning.<b>${o.review_today} for today</b></a>
          </div>
          <div class="desk-item index-card span2" ${item(5, 0.6)}>
            <h2>Work with your agent</h2>
            <p>Copy a brief that tells your agent where the note, the data and the APIs are.</p>
            <button class="btn primary" id="brief2">Brief your agent</button>
            ${me.hosted ? `<button class="btn" id="copycmd">Copy the run-locally command</button>
            <p class="faint" style="font-size:13px">Downloads the case and starts it on your machine. Needs Node 18+ and asks for your password.</p>` : ''}
            <div class="dl"><a class="btn small" href="/files/data/tables-csv.zip" download>All tables as CSV</a>${me.hosted ? '<a class="btn small" href="/files/ciabatta-ops-case.zip" download>Everything (zip)</a>' : ''}</div>
          </div>
          <a class="desk-item folder span2" ${item(6, -0.8)} href="#/supplies"><span class="folder__tab">Supplies</span><b>Supplier terms, and what one kept pair leaves us</b><span class="more">Open the folder</span></a>
          <div class="polaroids span2">
            <a class="desk-item polaroid" ${item(7, 3)} href="#/t/supplier_orders?col=supplier&val=Ortensi"><span class="tape" aria-hidden="true"></span><img src="/assets/img/how-workshop-900.jpg" alt="The Ortensi workshop" loading="lazy"><span>Ortensi, Porto Sant’Elpidio</span></a>
            <a class="desk-item polaroid" ${item(8, -2.6)} href="#/t/kade_stock"><span class="tape" aria-hidden="true"></span><img src="/assets/img/how-kade-900.jpg" alt="Kade Returns in Venlo" loading="lazy"><span>Kade, Venlo</span></a>
          </div>
          <div class="desk-item receipt" ${item(9, -0.8)}>
            <h2>Ciabatta Club</h2>
            <div class="receipt__meta">Last 30 days · printed 15.06.2026 08:30</div>
            ${line('Orders', o.orders_30d.toLocaleString('en'), '#/t/orders')}
            ${line('Revenue', `€${Math.round(o.revenue_30d_eur).toLocaleString('en')}`, '#/t/payments')}
            ${line('Customers', o.customers_30d.toLocaleString('en'), '#/t/orders')}
            ${line('Awaiting approval', o.pending_actions, '#/t/agent_actions?col=status&val=pending')}
            ${line('Open conversations', o.open_conversations, '#/t/conversations?col=status&val=open')}
            ${line('Agent spend', eur(o.agent_cost_30d_eur), '#/t/agent_runs')}
            <div class="receipt__total">${line('Humans on shift', '1 (away)', '#/t/tasks')}</div>
          </div>
          <div class="desk-item tag" ${item(10, 1.4)}>
            <h2>About this case</h2>
            <p>It isn’t meant to take a big chunk of your time. Use any AI agent you like. There’s more here than you’ll get through, so choosing what to look at is part of the job. Spend most of your time on your top one.</p>
            <p>Nothing to send beforehand. Bring what you made to a 45-minute call, no slides, and we’ll go through it together. We won’t open anything before then.</p>
            <a class="btn" href="${BOOKING_URL}" target="_blank" rel="noopener">Book your call</a>
          </div>
          <div class="desk-item ledger span2" ${item(11, 0.4)}><h2>Every table</h2>${tables.map(t => `<a href="#/t/${t.name}"><span>${esc(t.name)}</span><span>${t.rows.toLocaleString('en')}</span></a>`).join('')}</div>
        </div>
        <span class="coffee" aria-hidden="true"></span>
      </div>`;
    $('#brief2', page).addEventListener('click', briefAgent);
    $('#copycmd', page)?.addEventListener('click', () => copyLater(Promise.resolve(zipCmd()), 'Copied. Paste it into your terminal.'));
  };
  views.agents = async page => {
    const { agents } = await api('/admin/agents');
    agents.sort((a, b) => b.cost_eur - a.cost_eur);
    page.innerHTML = head('Agents', 'Prompt, context and tools as deployed today, with 30 days of model spend. Same files as agents/ in the case folder.') +
      agents.map(a => `<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
        <span><span style="font-family:var(--display);font-size:30px;text-transform:capitalize">${esc(a.agent)}</span> <span class="muted">${esc(ROLE[a.agent] || '')}</span></span>
        <span class="mono">${eur(a.cost_eur)} · ${a.runs.toLocaleString('en')} runs · avg ${a.avg_input_tokens.toLocaleString('en')} input tokens</span></div>
        <details><summary>Prompt, context and tools</summary><pre class="args">${esc(a.instructions)}</pre></details></div>`).join('');
  };
  views.files = async page => {
    const { files } = await api('/admin/files');
    const groups = files.reduce((m, f) => ((m[f.path.split('/')[0]] ||= []).push(f), m), {});
    const size = b => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);
    page.innerHTML = head('Case files', 'The same files as the case folder, for your own tools and agents.') +
      `<div class="grid two">${Object.entries(groups).map(([g, list]) => `<div class="card"><h2>${esc(g)}</h2>${list.map(f =>
        `<div class="frow"><a class="mono" href="${esc(f.url)}" download>${esc(f.path)}</a><span class="faint mono">${size(f.bytes)}</span></div>`).join('')}</div>`).join('')}</div>`;
  };

  // ---------- scrim for the row drawer and the mobile menu ----------
  let onClose = null;
  function scrim(close) {
    let el = $('.scrim');
    if (!el) { el = document.createElement('div'); el.className = 'scrim'; el.addEventListener('click', () => closeScrim()); document.body.append(el); }
    onClose = close; el.classList.add('on');
  }
  function closeScrim() { $('.scrim')?.classList.remove('on'); const f = onClose; onClose = null; f?.(); }
  addEventListener('keydown', e => { if (e.key === 'Escape' && onClose) closeScrim(); });
  const closeNav = () => { document.body.classList.remove('nav-open'); $('#navtoggle')?.setAttribute('aria-expanded', 'false'); };

  // ---------- shell, router ----------
  function renderOffline() {
    $('#app').innerHTML = `<div class="offline card"><h1>Start the server</h1><p>From the case folder run <code>node api/server.mjs</code>, then open <code>http://localhost:8787/admin/</code>.</p></div>`;
  }
  function shell(active) {
    if (!$('.shell')) {
      $('#app').innerHTML = `<div class="progress" aria-hidden="true"></div><div class="shell">
        <div class="announce"><span>Monday 15 June 2026 · 08:30 in Italy</span><span class="announce__sep">·</span><span>You’re covering for Sam until the 22nd</span></div>
        <header class="top"><div class="top__inner">
          <div class="top__left"><button class="icon-btn" id="navtoggle" aria-label="Menu" aria-expanded="false"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            <a class="top__link" href="#/t/tasks">Tasks</a><a class="top__link" href="#/t/agent_actions?col=status&val=pending">Approvals</a><a class="top__link" href="#/supplies">Supplies</a><span class="top__sep" aria-hidden="true"></span><a class="top__link" href="#/approach">Approach</a><a class="top__link" href="#/impact">Impact</a><a class="top__link" href="#/plan">Plan</a><a class="top__link" href="#/handoffs">Handoffs</a></div>
          <a class="top__brand" href="#/home">Ciabatta <i>Club</i><span>Back office</span></a>
          <div class="top__right"><button class="pill-btn" id="brief">Brief your agent</button>${me.admin ? '<a class="pill-btn" href="/_admin">Logins</a>' : ''}<a class="pill-btn" href="../" target="_blank" rel="noopener">View shop</a><a class="pill-btn pill-btn--dark" href="/logout">Log out</a></div>
        </div></header>
        <div class="body"><aside class="side" id="side"><div class="side__head"><b>Menu</b><button class="icon-btn" id="navclose" aria-label="Close menu"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
          <nav class="nav" aria-label="Back office"></nav>
          <div class="side__actions"><button class="btn small" id="brief-m">Brief your agent</button><a class="btn small" href="../" target="_blank" rel="noopener">View shop</a>${me.admin ? '<a class="btn small" href="/_admin">Logins</a>' : ''}<a class="btn small" href="/logout">Log out</a></div></aside>
          <main class="page" id="page" tabindex="-1"></main></div></div>`;
      $('#brief').addEventListener('click', briefAgent);
      $('#brief-m').addEventListener('click', briefAgent);
      $('#navtoggle').addEventListener('click', () => { document.body.classList.add('nav-open'); $('#navtoggle').setAttribute('aria-expanded', 'true'); scrim(closeNav); $('#navclose').focus(); });
      $('#navclose').addEventListener('click', closeScrim);
      let last = 0;
      addEventListener('scroll', () => { const y = scrollY; const hide = y > last && y > 140; $('.top')?.classList.toggle('is-hidden', hide); document.body.classList.toggle('top-hidden', hide); last = y; }, { passive: true });
    }
    document.querySelectorAll('.top__link').forEach(a => a.classList.toggle('on', a.getAttribute('href') === (active.startsWith('@') ? `#/${active.slice(1)}` : `#/t/${active}`)));
    if (document.body.classList.contains('nav-open')) closeScrim();
    $('.nav').innerHTML = `<a href="#/home" class="${active === '@home' ? 'on' : ''}">Home</a>` + NAV.map(([g, items]) => `<div class="group">${g}</div>` +
      items.map(([k, l]) => `<a href="${k.startsWith('@') ? `#/${k.slice(1)}` : `#/t/${k}`}" class="${k === active ? 'on' : ''}">${l}</a>`).join('')).join('');
    return $('#page');
  }
  async function route() {
    if (!me.checked) me = { ...(await api('/admin/me').catch(() => me)), checked: true };
    const [path, query] = (location.hash.replace(/^#\/?/, '') || 'home').split('?');
    const [a, b] = path.split('/');
    const params = new URLSearchParams(query || '');
    const page = shell(a === 't' ? b : `@${a}`);
    if (onClose) closeScrim();
    scrollTo(0, 0);
    const bar = $('.progress');
    bar.className = 'progress is-loading';
    page.classList.add('is-loading');
    try {
      if (a === 't') await tableView(page, params, b);
      else await (views[a] || views.home)(page, params);
      page.focus({ preventScroll: true });
      page.classList.remove('is-loading');
      bar.className = 'progress is-done';
    } catch (e) {
      if (e.message === 'Logged out') return;
      if (e instanceof TypeError) return renderOffline();
      page.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="mono">${esc(e.message)}</p></div>`;
    }
  }
  window.CC = { views, api, esc, eur, head, toast, SIM_NOW,
    start() { if (location.protocol === 'file:') return renderOffline(); addEventListener('hashchange', route); route(); } };
})();
