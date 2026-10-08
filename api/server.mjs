#!/usr/bin/env node
// Ciabatta Club mock APIs. No dependencies, Node 18+.
// Nothing is really sent: every write is kept in memory until restart and appended to api/outbox.jsonl.
// Hosted mode: logins live in $DATA_DIR/logins.json (hashed). CASE_ADMIN="name:password" sets the internal
// admin, who manages candidate logins at /_admin; CASE_LOGINS="name:password,..." seeds extra logins.
// With any login present the whole site needs one. Each login gets its own copy of everything it can
// change, and its own outbox under $DATA_DIR/outbox/.
import http from 'node:http';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV_DIR = path.join(ROOT, 'data', 'csv');
const OUTBOX = path.join(ROOT, 'api', 'outbox.jsonl');
const PORT = Number(process.env.PORT || 8787);
const SIM_NOW = '2026-06-15T06:30:00Z';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] === '' ? null : r[i]])));
}

const load = name => parseCsv(fs.readFileSync(path.join(CSV_DIR, `${name}.csv`), 'utf8'));
const baseDb = Object.fromEntries(fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv')).map(f => [f.slice(0, -4), load(f.slice(0, -4))]));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'api');
fs.mkdirSync(path.join(DATA_DIR, 'outbox'), { recursive: true });
const STORE_FILE = path.join(DATA_DIR, 'logins.json');
const store = fs.existsSync(STORE_FILE) ? JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) : { secret: crypto.randomBytes(32).toString('hex'), users: {} };
const saveStore = () => fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') });
const pairs = v => (v || '').split(',').map(x => x.trim()).filter(x => x.includes(':')).map(x => [x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 1)]);
for (const [u, pw] of pairs(process.env.CASE_LOGINS)) if (!store.users[u]) store.users[u] = { ...hashPw(pw), admin: false, created_at: new Date().toISOString(), note: 'seeded' };
const admins = pairs(process.env.CASE_ADMIN).map(([u]) => u);
if (admins.length) for (const u of Object.keys(store.users)) if (store.users[u].admin && !admins.includes(u)) delete store.users[u];
for (const [u, pw] of pairs(process.env.CASE_ADMIN)) store.users[u] = { ...(store.users[u] || { created_at: new Date().toISOString() }), ...hashPw(pw), admin: true, note: 'internal admin' };
if (Object.keys(store.users).length) saveStore();
const GATED = Object.keys(store.users).length > 0;
const session = new AsyncLocalStorage();
const currentUser = () => session.getStore()?.user || null;
const MUTABLE = ['orders', 'supplier_orders', 'payments', 'disputes', 'customer_messages', 'agent_actions'];
const userCopies = new Map();
const copyFor = user => {
  if (!userCopies.has(user)) userCopies.set(user, Object.fromEntries(MUTABLE.map(t => [t, baseDb[t].map(r => ({ ...r }))])));
  return userCopies.get(user);
};
const db = new Proxy(baseDb, { get: (target, key) => (currentUser() && MUTABLE.includes(key) ? copyFor(currentUser())[key] : target[key]) });
const loadJsonl = file => fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const inbox = loadJsonl('inbox/ops_inbox.jsonl');
const channel = loadJsonl('logs/agent_channel.jsonl');
const num = v => (v == null ? 0 : Number(v));
const by = (table, key, value) => db[table].filter(r => r[key] === value);
const one = (table, key, value) => db[table].find(r => r[key] === value) || null;
const seenIdempotencyKeys = new Map();
const unavailableAtOrtensi = new Set(db.supplier_orders.flatMap(so => (so.supplier_note || '').match(/[A-Z]{3}-[A-Z]{3}-\d{2}/g) || []));

const outboxFile = user => path.join(DATA_DIR, 'outbox', `${user.replace(/[^a-z0-9@._-]/gi, '_')}.jsonl`);
function record(kind, payload) {
  const file = currentUser() ? outboxFile(currentUser()) : OUTBOX;
  fs.appendFileSync(file, JSON.stringify({ recorded_at: new Date().toISOString(), sim_time: SIM_NOW, kind, ...payload }) + '\n');
}

function ortensiView(so) {
  return {
    ordine: so.supplier_order_id, riferimento: so.order_id, stato: so.status,
    data_ricezione: so.submitted_at, data_lavorazione: so.processing_at, data_spedizione: so.shipped_at,
    corriere: so.carrier, tracking: so.tracking_number, note: so.supplier_note,
    righe: by('order_lines', 'order_id', so.order_id).map(l => ({ articolo: l.sku, quantita: num(l.qty), lotto: l.lot })),
  };
}

function kadeView(r) {
  return {
    return_id: r.return_id, order_ref: r.order_id, sku: r.sku, carrier_tracking: r.label_tracking,
    status: r.kade_received_at ? 'received' : 'expected', received_at: r.kade_received_at, grade: r.grade,
  };
}

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler });

route('GET', '/health', () => [200, { ok: true, sim_time: SIM_NOW }]);

// Shop
route('GET', '/shop/orders/([^/]+)', ({ m }) => {
  const o = one('orders', 'order_id', m[1]);
  if (!o) return [404, { error: 'order not found' }];
  return [200, {
    ...o,
    lines: by('order_lines', 'order_id', o.order_id),
    supplier_order: one('supplier_orders', 'order_id', o.order_id),
    payments: by('payments', 'order_id', o.order_id),
    returns: by('returns', 'order_id', o.order_id),
  }];
});
route('PATCH', '/shop/orders/([^/]+)/address', ({ m, body }) => {
  const o = one('orders', 'order_id', m[1]);
  if (!o) return [404, { error: 'order not found' }];
  const updated = [];
  for (const k of ['ship_street', 'ship_line2', 'ship_postcode', 'ship_city']) {
    if (body[k] !== undefined) { o[k] = body[k]; updated.push(k); }
  }
  o.address_updated_at = SIM_NOW;
  record('shop.address_updated', { order_id: o.order_id, updated: Object.fromEntries(updated.map(k => [k, o[k]])) });
  return [200, { ok: true, order_id: o.order_id, updated }];
});

// Ortensi B2B
const ortensiOrders = () => db.supplier_orders.filter(so => so.supplier === 'Ortensi');
route('GET', '/ortensi/ordini', ({ q }) => {
  const list = ortensiOrders().filter(so => !q.stato || so.status === q.stato);
  return [200, { totale: list.length, ordini: list.map(ortensiView) }];
});
route('GET', '/ortensi/ordini/([^/]+)', ({ m }) => {
  const so = ortensiOrders().find(x => x.supplier_order_id === m[1]);
  return so ? [200, ortensiView(so)] : [404, { esito: 'KO', messaggio: 'Ordine non trovato' }];
});
route('POST', '/ortensi/ordini', ({ body }) => {
  if (!body.riferimento || !Array.isArray(body.righe) || !body.righe.length) {
    return [400, { esito: 'KO', messaggio: 'riferimento e righe sono obbligatori' }];
  }
  const id = `ORT-26-${34000 + db.supplier_orders.length}`;
  const missing = body.righe.map(r => r.articolo).filter(a => unavailableAtOrtensi.has(a));
  const so = {
    supplier_order_id: id, supplier: 'Ortensi', order_id: body.riferimento, submitted_at: SIM_NOW,
    status: missing.length ? 'SOSPESO' : 'RICEVUTO', status_updated_at: SIM_NOW,
    processing_at: null, shipped_at: null, carrier: null, tracking_number: null,
    supplier_note: missing.length ? `Articolo ${missing.join(', ')} non disponibile. Ordine sospeso in attesa di istruzioni.` : null,
  };
  db.supplier_orders.push(so);
  record('ortensi.order_created', { request: body, response: { ordine: id, stato: so.status } });
  return [200, { esito: 'OK', ordine: id, stato: so.status, messaggio: so.supplier_note || 'Ordine ricevuto' }];
});
route('POST', '/ortensi/ordini/([^/]+)/annulla', ({ m }) => {
  const so = ortensiOrders().find(x => x.supplier_order_id === m[1]);
  if (!so) return [404, { esito: 'KO', messaggio: 'Ordine non trovato' }];
  if (!['RICEVUTO', 'SOSPESO'].includes(so.status)) {
    record('ortensi.cancel_refused', { ordine: so.supplier_order_id, stato: so.status });
    return [409, { esito: 'KO', messaggio: 'Ordine già in lavorazione: contattare ordini@ortensi.example' }];
  }
  so.status = 'ANNULLATO';
  so.status_updated_at = SIM_NOW;
  record('ortensi.order_cancelled', { ordine: so.supplier_order_id, riferimento: so.order_id });
  return [200, { esito: 'OK', ordine: so.supplier_order_id, stato: 'ANNULLATO' }];
});
route('GET', '/ortensi/giacenze', () => [401, { errore: 'token scaduto', dettaglio: 'Generare un nuovo token dal portale B2B (utente amministratore).' }]);

// Carriers
const trackRoute = carrier => ({ m }) => {
  const events = db.tracking_events.filter(e => e.carrier === carrier && e.tracking_number === m[1])
    .sort((a, b) => a.event_time.localeCompare(b.event_time));
  return events.length ? [200, { tracking_number: m[1], carrier, events }] : [404, { error: 'unknown tracking number' }];
};
route('GET', '/gls/track/([^/]+)', trackRoute('GLS'));
route('GET', '/dhl/track/([^/]+)', trackRoute('DHL'));

// Kade Returns
route('GET', '/kade/returns', ({ q }) => {
  const list = db.returns.map(kadeView).filter(r => !q.status || r.status === q.status);
  return [200, { count: list.length, returns: list }];
});
route('GET', '/kade/returns/([^/]+)', ({ m }) => {
  const r = one('returns', 'return_id', m[1]);
  return r ? [200, kadeView(r)] : [404, { error: 'return not found' }];
});

route('GET', '/kade/stock', ({ q }) => {
  const list = db.kade_stock.filter(u => (!q.status || u.status === q.status) && (!q.sku || u.sku === q.sku));
  return [200, { count: list.length, units: list }];
});

// Payments
route('GET', '/payments', ({ q }) => [200, { payments: q.order_id ? by('payments', 'order_id', q.order_id) : db.payments }]);
route('POST', '/payments/refunds', ({ body }) => {
  const { order_id, amount_eur, reason, return_id, idempotency_key } = body;
  const idem = idempotency_key && `${currentUser() || ''}:${idempotency_key}`;
  if (idem && seenIdempotencyKeys.has(idem)) return [200, seenIdempotencyKeys.get(idem)];
  const charge = db.payments.find(p => p.order_id === order_id && p.kind === 'charge');
  if (!charge) return [404, { error: 'no charge for this order' }];
  const refunded = by('payments', 'order_id', order_id).filter(p => p.kind === 'refund').reduce((s, p) => s + num(p.amount_eur), 0);
  const refundable = Math.round((num(charge.amount_eur) - refunded) * 100) / 100;
  const amount = Number(amount_eur);
  if (!(amount > 0)) return [400, { error: 'amount_eur must be positive' }];
  if (amount > refundable + 1e-9) return [422, { error: 'amount exceeds refundable balance', refundable_eur: refundable }];
  const refund = {
    payment_id: { paypal: 'PPR-SIM', invoice: 'CN-SIM', card: 're_sim' }[charge.provider] + db.payments.length,
    order_id, provider: charge.provider, kind: 'refund', amount_eur: amount.toFixed(2),
    status: { paypal: 'completed', invoice: 'credited', card: 'succeeded' }[charge.provider], created_at: SIM_NOW,
    created_by: 'api', return_id: return_id || null, note: reason || null,
  };
  db.payments.push(refund);
  record('payments.refund', { request: body, response: refund });
  if (idem) seenIdempotencyKeys.set(idem, refund);
  return [201, refund];
});
route('GET', '/payments/disputes', ({ q }) => [200, { disputes: db.disputes.filter(d => !q.status || d.status === q.status) }]);
route('POST', '/payments/disputes/([^/]+)/(accept|contest)', ({ m, body }) => {
  const d = one('disputes', 'dispute_id', m[1]);
  if (!d) return [404, { error: 'dispute not found' }];
  if (d.status !== 'open') return [409, { error: `dispute is ${d.status}` }];
  d.status = m[2] === 'accept' ? 'accepted' : 'under_review';
  record(`payments.dispute_${m[2]}`, { dispute_id: d.dispute_id, evidence: body.evidence || null });
  return [200, d];
});

// Helpdesk
route('GET', '/helpdesk/conversations', ({ q }) => [200, { conversations: db.conversations.filter(c => !q.status || c.status === q.status) }]);
route('GET', '/helpdesk/conversations/([^/]+)', ({ m }) => {
  const c = one('conversations', 'conversation_id', m[1]);
  if (!c) return [404, { error: 'conversation not found' }];
  return [200, { ...c, messages: by('customer_messages', 'conversation_id', c.conversation_id), actions: by('agent_actions', 'conversation_id', c.conversation_id) }];
});
route('POST', '/helpdesk/conversations/([^/]+)/reply', ({ m, body }) => {
  const c = one('conversations', 'conversation_id', m[1]);
  if (!c) return [404, { error: 'conversation not found' }];
  if (!body.body) return [400, { error: 'body is required' }];
  const msg = { message_id: `msg_sim${db.customer_messages.length}`, sent_at: SIM_NOW, conversation_id: c.conversation_id, order_id: c.order_id, customer_id: c.customer_id,
    channel: c.channel, sender: 'ops', template: null, body: body.body, attachments: null, trigger_event_id: null };
  db.customer_messages.push(msg);
  record('helpdesk.reply', msg);
  return [201, msg];
});

// Approval queue
route('GET', '/actions', ({ q }) => {
  const list = db.agent_actions.filter(a => (!q.status || a.status === q.status)
    && (!q.review_today || a.review_today === q.review_today) && (!q.agent || a.agent === q.agent));
  return [200, { count: list.length, actions: list.map(a => ({ ...a, args: a.args ? JSON.parse(a.args) : null })) }];
});
route('POST', '/actions/([^/]+)', ({ m, body }) => {
  const a = one('agent_actions', 'action_id', m[1]);
  if (!a) return [404, { error: 'action not found' }];
  const status = { approve: 'approved', edit: 'edited', reject: 'rejected' }[body.decision];
  if (!status) return [400, { error: 'decision must be approve, edit or reject' }];
  if (a.status !== 'pending') return [409, { error: `already ${a.status}` }];
  a.status = status;
  a.decided_at = SIM_NOW;
  a.decided_by = 'you';
  a.decision_note = body.note || null;
  if (body.args) a.args = JSON.stringify(body.args);
  record('actions.decision', { action_id: a.action_id, decision: body.decision, args: body.args || null, note: body.note || null });
  return [200, { ...a, args: a.args ? JSON.parse(a.args) : null }];
});

// Staff admin: read-only summaries for site/admin/. Hosted, the case login covers it; locally it's open.
const sumEur = (rows, k = 'amount_eur') => Math.round(rows.reduce((s, r) => s + num(r[k]), 0) * 100) / 100;
const customerName = id => one('orders', 'customer_id', id)?.ship_name ?? null;
route('GET', '/admin/overview', () => {
  const pending = db.agent_actions.filter(a => a.status === 'pending');
  return [200, {
    sim_time: SIM_NOW,
    orders_30d: db.orders.length, revenue_30d_eur: sumEur(db.orders, 'total_eur'),
    customers_30d: new Set(db.orders.map(o => o.customer_id)).size,
    pending_actions: pending.length, review_today: pending.filter(a => a.review_today === '1').length,
    oldest_pending_at: pending.map(a => a.created_at).sort()[0],
    orders_by_status: db.orders.reduce((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {}),
    open_conversations: db.conversations.filter(c => c.status === 'open').length,
    returns_awaiting_refund: db.returns.filter(r => !db.payments.some(p => p.kind === 'refund' && p.return_id === r.return_id)).length,
    agent_cost_30d_eur: Math.round(db.agent_runs.reduce((s, r) => s + num(r.cost_eur), 0)),
    integrations: db.integrations.map(i => ({ name: i.name, status: i.status })),
  }];
});
route('GET', '/admin/orders', ({ q }) => {
  const term = (q.q || '').toLowerCase();
  const list = db.orders.filter(o => (!q.status || o.status === q.status) && (!term || o.order_id.toLowerCase().includes(term)
    || (o.ship_name || '').toLowerCase().includes(term) || (o.customer_email || '').includes(term)))
    .slice().reverse().slice(0, Number(q.limit || 100))
    .map(o => ({ ...o, supplier_status: one('supplier_orders', 'order_id', o.order_id)?.status }));
  return [200, { orders: list }];
});
route('GET', '/admin/orders/([^/]+)', ({ m }) => {
  const o = one('orders', 'order_id', m[1]);
  if (!o) return [404, { error: 'order not found' }];
  const so = one('supplier_orders', 'order_id', o.order_id);
  const rets = by('returns', 'order_id', o.order_id);
  return [200, {
    ...o, lines: by('order_lines', 'order_id', o.order_id), supplier_order: so,
    tracking: db.tracking_events.filter(e => e.order_id === o.order_id).sort((a, b) => a.event_time.localeCompare(b.event_time)),
    payments: by('payments', 'order_id', o.order_id), returns: rets, disputes: by('disputes', 'order_id', o.order_id),
    kade_units: db.kade_stock.filter(u => rets.some(r => r.return_id === u.return_id)),
    conversations: by('conversations', 'order_id', o.order_id), actions: by('agent_actions', 'order_id', o.order_id),
    messages: by('customer_messages', 'order_id', o.order_id),
    invoice_lines: by('supplier_invoice_lines', 'order_id', o.order_id).map(l => ({ ...l, invoice_date: one('supplier_invoices', 'invoice_id', l.invoice_id)?.invoice_date })),
    tasks: db.tasks.filter(t => t.order_id === o.order_id || (t.related_ref || '').includes(o.order_id)), reviews: by('reviews', 'order_id', o.order_id),
    inbox: inbox.filter(m => `${m.subject} ${m.body}`.includes(o.order_id)), channel: channel.filter(p => (p.text || '').includes(o.order_id)),
  }];
});
route('GET', '/admin/conversations', ({ q }) => [200, {
  conversations: db.conversations.filter(c => (!q.status || c.status === q.status) && (!q.topic || c.topic === q.topic))
    .slice().reverse().slice(0, Number(q.limit || 200)).map(c => ({ ...c, customer_name: customerName(c.customer_id) })),
}]);
route('GET', '/admin/returns', () => [200, {
  returns: db.returns.slice().reverse().map(r => ({
    ...r, customer_name: customerName(one('orders', 'order_id', r.order_id)?.customer_id),
    carrier_delivered_at: db.tracking_events.find(e => e.tracking_number === r.label_tracking && e.status === 'DELIVERED')?.event_time || null,
    refund: db.payments.find(p => p.kind === 'refund' && p.return_id === r.return_id) || null,
  })),
}]);
route('GET', '/admin/agents', () => {
  const agents = {};
  for (const r of db.agent_runs) {
    const a = (agents[r.agent] ||= { agent: r.agent, runs: 0, cost_eur: 0, input_tokens: 0, tasks: {} });
    a.runs++; a.cost_eur += num(r.cost_eur); a.input_tokens += num(r.input_tokens);
    const t = (a.tasks[r.task] ||= { task: r.task, model: r.model, runs: 0, cost_eur: 0 });
    t.runs++; t.cost_eur += num(r.cost_eur);
  }
  return [200, { agents: Object.values(agents).map(a => ({
    ...a, cost_eur: Math.round(a.cost_eur * 100) / 100, avg_input_tokens: Math.round(a.input_tokens / a.runs),
    tasks: Object.values(a.tasks).map(t => ({ ...t, cost_eur: Math.round(t.cost_eur * 100) / 100 })),
    instructions: ['prompt.md', 'context.md', 'tools.json'].map(f => path.join(ROOT, 'agents', a.agent, f)).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n\n---\n\n') || null,
  })) }];
});
route('GET', '/admin/integrations', () => [200, { integrations: db.integrations }]);
route('GET', '/admin/inbox', () => [200, { messages: inbox.slice().reverse() }]);
route('GET', '/admin/channel', ({ q }) => [200, { messages: channel.filter(c => !q.channel || c.channel === q.channel).slice().reverse() }]);
route('GET', '/admin/invoices', () => [200, { invoices: db.supplier_invoices }]);
route('GET', '/admin/invoices/(.+)', ({ m }) => [200, { lines: by('supplier_invoice_lines', 'invoice_id', decodeURIComponent(m[1])) }]);
route('GET', '/admin/economics', () => {
  const lines = db.order_lines, orders = db.orders;
  const product = Object.fromEntries(db.products.map(p => [p.sku, p]));
  const early = new Set(db.orders.filter(o => o.status === 'delivered' && o.created_at < '2026-05-28').map(o => o.order_id));
  const earlyLines = lines.filter(l => early.has(l.order_id));
  const scanned = db.returns.filter(r => r.grade);
  const invoiceCharges = db.payments.filter(p => p.provider === 'invoice' && p.kind === 'charge');
  const dueInvoices = invoiceCharges.filter(p => p.status !== 'open');
  const share = (arr, f) => (arr.length ? arr.filter(f).length / arr.length : 0);
  return [200, {
    window_days: 30, orders: orders.length, pairs: lines.length,
    avg_price_incl_vat: sumEur(lines, 'unit_price_eur') / lines.length,
    avg_cost_ex_vat: lines.reduce((s, l) => s + num(product[l.sku].wholesale_price_eur), 0) / lines.length,
    ...(() => {
      const supplierOf = sku => (['ULT', 'LOF', 'SOX'].includes(sku.slice(0, 3)) ? 'Ciabatta' : 'Ortensi');
      const ort = lines.filter(l => supplierOf(l.sku) === 'Ortensi'), cb = lines.filter(l => supplierOf(l.sku) === 'Ciabatta');
      const avg = ls => ls.reduce((s, l) => s + num(product[l.sku].wholesale_price_eur), 0) / (ls.length || 1);
      return { ortensi_pair_share: ort.length / lines.length, avg_cost_ortensi: avg(ort), avg_cost_ciabatta: avg(cb) };
    })(),
    pairs_per_order: lines.length / orders.length,
    return_rate: earlyLines.length ? db.returns.filter(r => early.has(r.order_id)).length / earlyLines.length : 0,
    grade_shares: { A: share(scanned, r => r.grade === 'A'), B: share(scanned, r => r.grade === 'B'), C: share(scanned, r => r.grade === 'C') },
    payment_mix: { card: share(orders, o => o.payment_provider === 'card'), paypal: share(orders, o => o.payment_provider === 'paypal'), invoice: share(orders, o => o.payment_provider === 'invoice') },
    credit_loss_rate: dueInvoices.length ? sumEur(dueInvoices.filter(p => p.status === 'overdue')) / sumEur(dueInvoices) : 0,
    dispute_rate: db.disputes.length / orders.length,
    agent_cost_30d_eur: db.agent_runs.reduce((s, r) => s + num(r.cost_eur), 0),
    kade_stock: db.kade_stock.reduce((m, u) => ((m[u.status] = (m[u.status] || 0) + 1), m), {}),
    products: (() => {
      const supplierOf = sku => (['ULT', 'LOF', 'SOX'].includes(sku.slice(0, 3)) ? 'Ciabatta' : 'Ortensi');
      const by = {};
      for (const l of lines) {
        const m = l.sku.slice(0, 3);
        const x = (by[m] ||= { code: m, name: product[l.sku].model, supplier: supplierOf(l.sku), pairs: 0, early: 0, returned: 0, price_incl: num(product[l.sku].retail_price_eur), cost: num(product[l.sku].wholesale_price_eur), grades: { A: 0, B: 0, C: 0 } });
        x.pairs++;
        if (early.has(l.order_id)) x.early++;
      }
      for (const r of db.returns) {
        const x = by[r.sku.slice(0, 3)];
        if (early.has(r.order_id)) x.returned++;
        if (r.grade) x.grades[r.grade]++;
      }
      return Object.values(by).map(x => {
        const g = x.grades.A + x.grades.B + x.grades.C || 1;
        return { ...x, return_rate: x.early ? x.returned / x.early : 0, grade_shares: { A: x.grades.A / g, B: x.grades.B / g, C: x.grades.C / g } };
      }).sort((a, b) => b.pairs - a.pairs);
    })(),
    terms: [
      { supplier: 'Ortensi', who: 'Calzaturificio Ortensi S.r.l. · family workshop, Porto Sant’Elpidio · agreement since March 2025', sections: [
        ['Pricing', [
          ['Cost price', 'List price less 48% trade discount (see products.wholesale_price_eur); +8% on everything shipped from 1 June 2026'],
          ['Price changes', '30 days’ written notice'],
          ['Retail price', 'Recommended retail prices; discounts deeper than 20% need Ortensi’s approval'],
          ['Currency and VAT', 'EUR; intra-EU reverse charge'],
        ]],
        ['Payment', [
          ['Payment terms', '30 days net from invoice date; weekly invoice every Friday'],
          ['Cash discount', '2% if paid within 10 days of the invoice date'],
          ['Late payment', 'Statutory interest (ECB rate + 8%) plus €40 per late invoice'],
          ['Credit limit', '€120,000 open balance'],
        ]],
        ['Logistics', [
          ['Delivery', 'Dropships every order to the customer, DAP, with GLS at €7.90 per parcel'],
          ['Cut-off', 'Orders in by 12:00 UTC ship the same working day; closed weekends and Italian public holidays'],
          ['Minimum order', 'None for dropship orders'],
        ]],
        ['Returns and claims', [
          ['Unsold returns', '100% credit if received within 60 days of Kade’s scan; return pallet at our cost'],
          ['Defects', '12 months; credit against photo and lot number, claimed once a month'],
          ['Transit damage', 'Report within 48 hours of delivery'],
        ]],
        ['Commercial', [
          ['Co-marketing', '€1,500 a month, ended 1 June 2026'],
          ['Volume rebate', 'None'],
          ['Territory', 'EU, non-exclusive'],
          ['Contract', '12 months, renews automatically; 90 days’ notice'],
        ]],
        ['Systems', [['Orders and stock', 'B2B API for orders and status; stock feed every 2 hours; API tokens expire every 90 days']]],
      ] },
      { supplier: 'Ciabatta', who: 'Ciabatta S.r.l. · Ultra Comfort brand, warehouse in Bergamo · partner since March 2026', sections: [
        ['Pricing', [
          ['Cost price', 'Ultra Comfort €36 · Loafer €68 · Socks €5'],
          ['Price changes', '60 days’ notice; prices fixed for the season'],
          ['Retail price', 'Ultra Comfort €79 · Loafer €149 · Socks €19; promotions deeper than 15% need Ciabatta’s approval'],
          ['Currency and VAT', 'EUR; intra-EU reverse charge'],
        ]],
        ['Payment', [
          ['Payment terms', '14 days net from invoice date; weekly invoice every Monday'],
          ['Cash discount', 'None'],
          ['Late payment', 'Credit hold after a final written reminder once anything is more than 7 days overdue; statutory interest plus €40 per late invoice'],
          ['Credit limit', '€25,000 open balance'],
        ]],
        ['Logistics', [
          ['Delivery', 'Dropships every order to the customer, DAP, with GLS at €6.50 per parcel'],
          ['Cut-off', 'SFTP orders picked up every 30 minutes; email orders once a day at 13:00 Italian time'],
          ['Minimum order', 'None'],
        ]],
        ['Returns and claims', [
          ['Unsold returns', 'Not taken back: returns, resale and write-offs are ours'],
          ['Defects', '6 months; credit against photo'],
          ['Transit damage', 'Report within 72 hours of delivery'],
        ]],
        ['Commercial', [
          ['Co-marketing', 'None'],
          ['Volume rebate', '3% on purchases above €100,000 a quarter, paid as a credit note'],
          ['Territory', 'EU, non-exclusive'],
          ['Contract', '12 months from March 2026; 60 days’ notice'],
        ]],
        ['Systems', [['Orders and stock', 'SFTP for orders, daily stock file and hourly tracking; email orders only while setting up']]],
      ] },
    ],
  }];
});
// Every table, for the admin's table browser. Logs and the inbox are exposed as tables too.
const flat = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)]));
const LOG_TABLES = { ops_inbox: inbox.map(flat), agent_channel: channel.map(flat), agent_trace: loadJsonl('logs/agent_trace.jsonl').map(flat) };
const TABLES = () => ({ ...db, ...LOG_TABLES });
route('GET', '/admin/tables', () => [200, { tables: Object.entries(TABLES()).map(([name, rows]) => ({ name, rows: rows.length, columns: Object.keys(rows[0] || {}) })) }]);
const csvCell = v => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
route('GET', '/admin/me', () => [200, { user: currentUser(), hosted: GATED, admin: !!store.users[currentUser()]?.admin }]);
route('GET', '/admin/tables/([a-z_]+)', ({ m, q }) => {
  const rows = TABLES()[m[1]];
  if (!rows) return [404, { error: 'no such table' }];
  const columns = Object.keys(rows[0] || {});
  const term = (q.q || '').toLowerCase();
  let list = rows.filter(r => (!q.col || String(r[q.col] ?? '') === q.val) && (!term || columns.some(c => String(r[c] ?? '').toLowerCase().includes(term))));
  if (q.sort && columns.includes(q.sort)) {
    const dir = q.dir === 'desc' ? -1 : 1;
    const numeric = list.every(r => r[q.sort] == null || !isNaN(Number(r[q.sort])));
    list = list.slice().sort((a, b) => (a[q.sort] == null) - (b[q.sort] == null) || dir * (numeric ? Number(a[q.sort]) - Number(b[q.sort]) : String(a[q.sort]).localeCompare(String(b[q.sort]))));
  }
  if (q.format === 'csv') return [200, [columns, ...list.map(r => columns.map(c => r[c]))].map(l => l.map(csvCell).join(',')).join('\n') + '\n',
    { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${m[1]}.csv"` }];
  const limit = Math.min(Number(q.limit || 50), 500), offset = Number(q.offset || 0);
  return [200, { table: m[1], columns, total: list.length, offset, rows: list.slice(offset, offset + limit) }];
});

route('GET', '/admin/related', ({ q }) => {
  const pairs = (q.keys || '').split(',').filter(x => x.includes(':')).map(x => [x.slice(0, x.indexOf(':')), decodeURIComponent(x.slice(x.indexOf(':') + 1))]);
  const related = [];
  for (const [name, rows] of Object.entries(TABLES())) {
    const cols = Object.keys(rows[0] || {});
    for (const [k, v] of pairs) {
      if (!cols.includes(k) || `${name}.${k}` === q.skip) continue;
      const n = rows.reduce((t, r) => t + (String(r[k] ?? '') === v), 0);
      if (n) related.push({ table: name, col: k, val: v, rows: n });
    }
  }
  return [200, { related }];
});

route('GET', '/admin/files', () => {
  const list = [];
  for (const dir of SHARED) {
    const walk = rel => {
      for (const f of fs.readdirSync(path.join(ROOT, rel))) {
        const p = path.join(rel, f);
        if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p);
        else list.push({ path: p, bytes: fs.statSync(path.join(ROOT, p)).size, url: `/files/${p}` });
      }
    };
    walk(dir);
  }
  return [200, { files: list }];
});

// Mail
route('POST', '/mail/send', ({ body }) => {
  if (!body.to || !body.body) return [400, { error: 'to and body are required' }];
  record('mail.sent', { to: body.to, subject: body.subject || '', body: body.body });
  return [202, { ok: true, queued: true }];
});

const TEXT = /^(text\/|application\/(json|javascript|x-ndjson)|image\/svg)/;
const acceptsGzip = req => /\bgzip\b/.test(req.headers['accept-encoding'] || '');
function sendBody(req, res, status, headers, body) {
  if (acceptsGzip(req) && TEXT.test(headers['content-type'] || '') && Buffer.byteLength(body) > 1024) {
    body = zlib.gzipSync(body); headers = { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' };
  }
  res.writeHead(status, headers); res.end(body);
}

async function handle(req, res) {
  res.setHeader('x-robots-tag', 'noindex, nofollow');
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'invalid JSON body' }));
  }
  const q = Object.fromEntries(url.searchParams);
  for (const r of routes) {
    const m = r.method === req.method && url.pathname.match(r.re);
    if (m) {
      const [status, payload, headers] = r.handler({ m, q, body });
      if (headers) return sendBody(req, res, status, headers, payload);
      return sendBody(req, res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, JSON.stringify(payload, null, 2));
    }
  }
  const old = url.pathname.match(/^\/(index|shop|product|how-it-works|careers)\.html$/);
  if (old && ['GET', 'HEAD'].includes(req.method)) { res.writeHead(301, { location: (old[1] === 'index' ? '/' : `/${old[1]}`) + url.search }); return res.end(); }
  if ((req.method === 'GET' || req.method === 'HEAD') && serveFile(url.pathname, req, res)) return;
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'no such endpoint; see docs/api.md' }));
}

// The storefront and admin live in site/; case files are downloadable under /files/.
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.db': 'application/octet-stream', '.zip': 'application/zip' };
const SHARED = ['data', 'docs', 'logs', 'inbox', 'agents'];
function serveFile(pathname, req, res) {
  let rel = decodeURIComponent(pathname);
  let base = path.join(ROOT, 'site');
  if (['/files/README.md', '/files/note-from-sam.md', '/files/ciabatta-ops-case.zip'].includes(rel)) { rel = rel.slice('/files'.length); base = ROOT; }
  else if (rel.startsWith('/files/')) {
    rel = rel.slice('/files'.length);
    if (!SHARED.includes(rel.split('/')[1])) return false;
    base = ROOT;
  }
  let file = path.normalize(path.join(base, rel));
  const inside = path.relative(base, file);
  if (inside.startsWith('..') || path.isAbsolute(inside)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(`${file}.html`)) file += '.html'; // /careers -> careers.html
  if (!fs.existsSync(file)) return false;
  let type = TYPES[path.extname(file)] || 'application/octet-stream';
  if (file.endsWith('.jpg') && /image\/webp/.test(req.headers.accept || '') && fs.existsSync(`${file}.webp`)) { file += '.webp'; type = 'image/webp'; }
  const st = fs.statSync(file), etag = `W/"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
  const cache = /\.(jpg|webp|png|svg)$/.test(file) ? 'public, max-age=604800' : /\.(js|css)$/.test(file) ? 'no-cache' : 'private, no-cache';
  const headers = { 'content-type': type, etag, 'cache-control': cache, vary: 'Accept, Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }
  if (acceptsGzip(req) && TEXT.test(type) && st.size > 1024) { res.writeHead(200, { ...headers, 'content-encoding': 'gzip' }); fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res); return true; }
  res.writeHead(200, { ...headers, 'content-length': st.size });
  fs.createReadStream(file).pipe(res);
  return true;
}

// ---------- login gate (hosted mode only) ----------
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(c => c[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const findUser = u => Object.keys(store.users).find(k => k.toLowerCase() === String(u || '').trim().toLowerCase());
const checkPw = (u, pw) => { const x = store.users[u]; return !!x && safeEqual(hashPw(pw, x.salt).hash, x.hash); };
const sign = v => crypto.createHmac('sha256', store.secret).update(v).digest('base64url');
const makeSession = u => { const v = `${Buffer.from(u).toString('base64url')}.${Date.now() + 14 * 864e5}`; return `${v}.${sign(v)}`; };
const lastSeen = new Map();

// ---------- visits and usage (hosted only): cookie-free counts in $DATA_DIR/analytics.json ----------
// Visitors are counted per day as a keyed hash of IP + browser + date; no raw IPs or cookies are kept.
const STATS_FILE = path.join(DATA_DIR, 'analytics.json');
const stats = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) : { days: {}, users: {} };
let statsDirty = false;
const saveStats = () => { if (statsDirty) { fs.writeFileSync(STATS_FILE, JSON.stringify(stats)); statsDirty = false; } };
setInterval(saveStats, 30e3).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveStats(); process.exit(0); });
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|curl|wget|python|node|headless|monitor/i;
const today = () => new Date().toISOString().slice(0, 10);
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const pageName = p => (p.replace(/\.html$/, '').replace(/^\/index$/, '/') || '/');
function trackVisit(req, url) {
  if (BOTS.test(req.headers['user-agent'] || '')) return;
  const d = (stats.days[today()] ||= { views: 0, visitors: [], pages: {}, referrers: {}, clicks: {} });
  statsDirty = true;
  if (url.pathname === '/apply' || url.pathname === '/dm') return bump(d.clicks, url.pathname.slice(1));
  d.views += 1;
  bump(d.pages, pageName(url.pathname));
  const v = crypto.createHmac('sha256', store.secret).update(`${clientIp(req)}|${req.headers['user-agent'] || ''}|${today()}`).digest('base64url').slice(0, 12);
  if (!d.visitors.includes(v)) d.visitors.push(v);
  let ref = '';
  try { ref = new URL(req.headers.referer || '').hostname.replace(/^www\./, ''); } catch { /* no referrer */ }
  if (ref && !/(^|\.)(ciabatta\.droppe\.com|fly\.dev)$/.test(ref)) bump(d.referrers, ref);
}
function trackUse(user, req, url) {
  if (url.pathname.startsWith('/assets/') || /\.(css|js|png|jpe?g|webp|svg|woff2?|ico|mp4|vtt)$/.test(url.pathname)) return;
  const u = (stats.users[user] ||= { first_seen: null, last_seen: null, requests: 0, active_minutes: 0, minute: '', tables: [], downloads: 0, api_calls: 0 });
  const now = new Date().toISOString();
  u.first_seen ||= now; u.last_seen = now; u.requests += 1; statsDirty = true;
  if (u.minute !== now.slice(0, 16)) { u.minute = now.slice(0, 16); u.active_minutes += 1; }
  const t = url.pathname.match(/^\/admin\/tables\/([a-z_]+)$/);
  if (t && !u.tables.includes(t[1])) u.tables.push(t[1]);
  if (/\.zip$/.test(url.pathname) || url.searchParams.get('format') === 'csv') u.downloads += 1;
  if (/^Basic /.test(req.headers.authorization || '')) u.api_calls += 1;
}
function statsSummary() {
  const days = Object.keys(stats.days).sort().reverse();
  const last = n => days.filter(d => d > new Date(Date.now() - n * 864e5).toISOString().slice(0, 10));
  const sum = (ds, f) => ds.reduce((t, d) => t + f(stats.days[d]), 0);
  const merge = (ds, k) => Object.entries(ds.reduce((m, d) => { for (const [x, n] of Object.entries(stats.days[d][k] || {})) bump(m, k === 'pages' ? pageName(x) : x, n); return m; }, {})).sort((a, b) => b[1] - a[1]);
  const window = ds => ({ visitors: sum(ds, d => d.visitors.length), views: sum(ds, d => d.views), apply: sum(ds, d => d.clicks.apply || 0), dm: sum(ds, d => d.clicks.dm || 0) });
  return { today: window(last(1)), last_7_days: window(last(7)), all_time: window(days), pages_7d: merge(last(7), 'pages').slice(0, 8), referrers_7d: merge(last(7), 'referrers').slice(0, 8),
    by_day: days.slice(0, 14).map(d => ({ day: d, visitors: stats.days[d].visitors.length, views: stats.days[d].views, apply: stats.days[d].clicks.apply || 0, dm: stats.days[d].clicks.dm || 0 })),
    usage: Object.fromEntries(Object.entries(stats.users).map(([u, x]) => [u, { first_seen: x.first_seen, last_seen: x.last_seen, active_minutes: x.active_minutes, tables_opened: x.tables.length, downloads: x.downloads, api_calls: x.api_calls, requests: x.requests }])) };
}
function userFrom(req) {
  const token = cookies(req).cc_session;
  if (token) {
    const [u64, exp, mac] = token.split('.');
    const v = `${u64}.${exp}`, u = Buffer.from(u64 || '', 'base64url').toString();
    if (mac && safeEqual(sign(v), mac) && Number(exp) > Date.now() && store.users[u]) return u;
  }
  const basic = (req.headers.authorization || '').match(/^Basic (.+)$/);
  if (basic) {
    const raw = Buffer.from(basic[1], 'base64').toString(), u = findUser(raw.slice(0, raw.indexOf(':')));
    if (u && checkPw(u, raw.slice(raw.indexOf(':') + 1))) return u;
  }
  return null;
}
const PAGE_CSS = `body{margin:0;min-height:100vh;background:#ECE8E1;font:16px/1.5 "Avenir Next",Avenir,"Segoe UI",sans-serif;color:#1E1A16}
h1{margin:0;font:400 34px/1.1 "Iowan Old Style",Charter,Georgia,serif}p{margin:0;color:#5B534B}label{font:600 12px/1 inherit;letter-spacing:.1em;text-transform:uppercase;color:#5B534B}
input{font:inherit;padding:12px 14px;border:1px solid #E3DACB;border-radius:12px}button{font:600 12px/1 inherit;letter-spacing:.1em;text-transform:uppercase;padding:14px 18px;border:0;border-radius:999px;background:#212121;color:#fff;cursor:pointer}
.err{color:#A33A2A;min-height:20px;font-size:14px}`;
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The login is the shop's landing page, dimmed and locked, with a login card on top. Removing the card only
// reveals the public landing page: every other page, file and API stays behind the server-side gate.
const GATE_CSS = `html,body{overflow:hidden!important;overscroll-behavior:none}body>:not(.gate){pointer-events:none;user-select:none}
.gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;overflow:auto;background:rgba(20,18,16,.36);-webkit-backdrop-filter:blur(10px) saturate(1.05);backdrop-filter:blur(10px) saturate(1.05);animation:gate-fade .3s ease-out}
.gate__card{position:relative;width:min(900px,100%);display:grid;grid-template-columns:1.05fr 1fr;background:var(--card);border-radius:28px;overflow:hidden;box-shadow:0 40px 120px rgba(20,18,16,.35),0 2px 8px rgba(20,18,16,.08);animation:gate-in .55s var(--ease) both}
.gate__art{position:relative;min-height:560px;color:#fff;padding:28px 30px;display:flex;flex-direction:column;justify-content:space-between;isolation:isolate}
.gate__art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:24% 62%;z-index:-2}
.gate__art::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,18,16,.38) 0%,rgba(20,18,16,0) 28%,rgba(20,18,16,0) 50%,rgba(20,18,16,.62) 100%)}
.gate__mark{font:var(--display-weight) 26px/1 var(--font-display);letter-spacing:-.01em}.gate__mark i{font-style:italic}
.gate__art blockquote{margin:0;font:var(--display-weight) clamp(24px,2.6vw,32px)/1.12 var(--font-display);letter-spacing:-.01em;max-width:13ch;text-wrap:balance;text-shadow:0 1px 18px rgba(0,0,0,.25)}
.gate__form{padding:52px 48px 36px;display:grid;gap:16px;align-content:center}
.gate__kicker{margin:0;font:600 12px/1 var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px}
.gate__kicker::before{content:"";width:8px;height:8px;border-radius:50%;background:#B8532F}
.gate h1{margin:0;font:var(--display-weight) 50px/1 var(--font-display);letter-spacing:-.015em}
.gate__lede{margin:0 0 8px;color:var(--muted);font-size:15.5px;line-height:1.55;text-wrap:pretty}
.gate__field{display:grid;gap:7px}.gate__field>span{font:500 13px/1 var(--font-ui);color:var(--ink-2)}
.gate__field input{width:100%;box-sizing:border-box;font:16px/1.2 var(--font-ui);color:var(--ink);height:50px;padding:0 16px;border:1px solid transparent;border-radius:14px;background:var(--surface);transition:background-color .2s,border-color .2s,box-shadow .2s}
.gate__field input:hover{border-color:var(--line-2)}.gate__field input:focus,.gate__field input:focus-visible{outline:none;background:#fff;border-color:var(--ink);box-shadow:0 0 0 4px rgba(33,33,33,.08)}
.gate__pw{position:relative;display:block}.gate__pw input{padding-right:72px}
.gate__show{position:absolute;right:8px;top:50%;transform:translateY(-50%);height:34px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--ink-2);font:600 13px/1 var(--font-ui);cursor:pointer}.gate__show:hover{background:rgba(33,33,33,.06)}
.gate__err{margin:0;padding:11px 14px;border-radius:12px;background:#FBEDEA;color:#A33A2A;font-size:14px}
.gate__go{margin-top:6px;height:52px;border:0;border-radius:999px;background:var(--dark);color:var(--on-dark);font:600 15px/1 var(--font-ui);letter-spacing:.02em;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;transition:transform .2s var(--ease),box-shadow .2s}
.gate__go:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(20,18,16,.18)}.gate__go svg{transition:transform .2s var(--ease)}.gate__go:hover svg{transform:translateX(3px)}
.gate__foot{margin:6px 0 0;text-align:center;color:var(--faint);font-size:13px}.gate__foot a{color:var(--ink-2)}
.gate__close{position:absolute;top:18px;right:18px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;z-index:2;background:var(--surface);color:var(--ink);font:400 24px/1 var(--font-ui);text-decoration:none;transition:background-color .2s}.gate__close:hover{background:#ebe5db}
:focus:not(:focus-visible){outline:none}
@keyframes gate-fade{from{opacity:0}}@keyframes gate-in{from{opacity:0;transform:translateY(14px) scale(.985)}}
@media (max-width:760px){.gate{place-items:start center;padding:14px}.gate__card{grid-template-columns:1fr}.gate__art{min-height:150px;padding:20px 22px}.gate__art blockquote{display:none}.gate__form{padding:30px 24px 26px}.gate h1{font-size:40px}}
@media (prefers-reduced-motion:reduce){.gate,.gate__card{animation:none}}`;
const ARROW = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
const loginPage = (error = '', next = '', user = '') => INDEX_HTML
  .replace('</head>', `<meta name="robots" content="noindex"><style>${GATE_CSS}</style></head>`)
  .replace(/<body[^>]*>/, m => `${m}<div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title"><div class="gate__card"><a class="gate__close" href="/" aria-label="Back to the shop">×</a>
<div class="gate__art"><img src="assets/img/lifestyle-scene-terrace-900.jpg" srcset="assets/img/lifestyle-scene-terrace-900.jpg 900w, assets/img/lifestyle-scene-terrace.jpg 1600w" sizes="(max-width:760px) 100vw, 460px" alt="">
<div class="gate__mark">Ciabatta <i>Club</i></div><blockquote>Five agents, one human, two thousand customers a month.</blockquote></div>
<form class="gate__form" method="post" action="/login"><p class="gate__kicker">Private preview</p><h1 id="gate-title">Welcome in.</h1>
<p class="gate__lede">Log in with the details from your invitation. Sam left you a note in the back office.</p><input type="hidden" name="next" value="${escHtml(next)}">
<label class="gate__field"><span>Email</span><input name="user" value="${escHtml(user)}" autocomplete="username" autocapitalize="none" spellcheck="false" required${user ? '' : ' autofocus'}></label>
<label class="gate__field"><span>Password</span><span class="gate__pw"><input name="password" type="password" autocomplete="current-password" required${user ? ' autofocus' : ''}><button class="gate__show" type="button" aria-pressed="false">Show</button></span></label>
${error ? `<p class="gate__err" role="alert">${escHtml(error)}</p>` : ''}<button class="gate__go">Log in ${ARROW}</button>
<p class="gate__foot">Operations is invite-only. <a href="/careers">How to get an invite</a> · <a href="/">Back to the shop</a></p></form></div></div>`)
  .replace('</body>', `<script>(() => { const next = document.querySelector('.gate input[name=next]'); if (next && next.value && location.hash) next.value += location.hash;
const show = document.querySelector('.gate__show'), pw = document.querySelector('.gate input[name=password]');
show.addEventListener('click', () => { const on = pw.type === 'password'; pw.type = on ? 'text' : 'password'; show.textContent = on ? 'Hide' : 'Show'; show.setAttribute('aria-pressed', String(on)); pw.focus(); });
addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '/'; });
const lock = n => { if (n.nodeType === 1 && !n.classList.contains('gate')) n.inert = true; };
[...document.body.children].forEach(lock); new MutationObserver(r => r.forEach(x => x.addedNodes.forEach(lock))).observe(document.body, { childList: true }); })();</script></body>`);

// ---------- internal admin: candidate logins and what each candidate did ----------
const newPassword = () => Array.from({ length: 3 }, () => crypto.randomBytes(3).toString('hex').slice(0, 4)).join('-');
const activity = u => (fs.existsSync(outboxFile(u)) ? fs.readFileSync(outboxFile(u), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const loginList = () => Object.entries(store.users).map(([u, x]) => ({ user: u, admin: !!x.admin, note: x.note || '', created_at: x.created_at, last_seen: stats.users[u]?.last_seen || lastSeen.get(u) || null, actions: activity(u).length, use: stats.users[u] || null }));
function visitsCard() {
  const s = statsSummary(), w = (label, x) => `<div class="stat"><b>${x.visitors}</b><span>visitors</span><em>${label}</em><small>${x.views} views · ${x.apply} Hub · ${x.dm} DM</small></div>`;
  const list = (title, rows) => `<div><h3>${title}</h3>${rows.length ? rows.map(([k, n]) => `<div class="row"><span>${escHtml(k)}</span><b>${n}</b></div>`).join('') : '<p class="muted">Nothing yet.</p>'}</div>`;
  return `<div class="card"><h2>Visits</h2><div class="stats">${w('today', s.today)}${w('last 7 days', s.last_7_days)}${w('all time', s.all_time)}</div>
<div class="lists">${list('Pages, 7 days', s.pages_7d)}${list('Came from, 7 days', s.referrers_7d)}</div>
<p class="muted">Counted without cookies: a visitor is one browser on one day. Hub and DM are clicks on the careers page buttons. Bots and link previews are left out.</p></div>`;
}
function adminPage(flash = '') {
  const rows = loginList().map(l => `<tr><td><b>${escHtml(l.user)}</b>${l.admin ? ' <span class="tag">admin</span>' : ''}<div class="muted">${escHtml(l.note)}</div></td>
    <td>${escHtml((l.created_at || '').slice(0, 16).replace('T', ' '))}</td><td>${escHtml((l.last_seen || '—').slice(0, 16).replace('T', ' '))}</td>
    <td><a href="/_admin/activity/${encodeURIComponent(l.user)}">${l.actions} actions</a>${l.use ? `<div class="muted">${l.use.active_minutes} active min · ${l.use.tables.length} tables · ${l.use.downloads} downloads · ${l.use.api_calls} API calls</div>` : '<div class="muted">not signed in yet</div>'}</td>
    <td class="acts">${l.admin ? '' : `<form method="post" action="/_admin/password/${encodeURIComponent(l.user)}"><button class="ghost">New password</button></form>
      <form method="post" action="/_admin/reset/${encodeURIComponent(l.user)}"><button class="ghost">Reset data</button></form>
      <form method="post" action="/_admin/remove/${encodeURIComponent(l.user)}" onsubmit="return confirm('Remove ${escHtml(l.user)}?')"><button class="ghost danger">Remove</button></form>`}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ciabatta case · Logins</title><meta name="robots" content="noindex">
<style>${PAGE_CSS}main{max-width:1100px;margin:0 auto;padding:40px 24px}.card{background:#fff;border-radius:20px;padding:28px;margin-top:20px}table{width:100%;border-collapse:collapse;font-size:15px}
th{text-align:left;font:600 11px/1 "SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8C8378;padding:10px 8px;border-bottom:1px solid #E6DDCF}td{padding:12px 8px;border-bottom:1px solid #E6DDCF;vertical-align:top}
.muted{color:#8C8378;font-size:13px}.tag{font-size:11px;background:#212121;color:#fff;border-radius:99px;padding:2px 8px}.acts{display:flex;gap:6px;flex-wrap:wrap}.acts form{margin:0}
button.ghost{background:transparent;color:#1E1A16;border:1px solid rgba(33,33,33,.2);padding:9px 12px}button.danger{color:#A33A2A;border-color:rgba(163,58,42,.3)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}.stat{background:#F4F1EA;border-radius:14px;padding:16px;display:grid;gap:2px}.stat b{font:400 34px/1 "Iowan Old Style",Georgia,serif}.stat em{font-style:normal;font-size:13px;color:#8C8378}.stat small{font-size:13px}
.lists{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:8px 0 12px}.lists h3{font:600 11px/1 "SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8C8378;margin:0 0 8px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E6DDCF;font-size:14px}
h2{margin:0;font:400 26px/1.1 "Iowan Old Style",Georgia,serif}.add{display:flex;gap:10px;flex-wrap:wrap;align-items:end}.add div{display:grid;gap:6px}.flash{background:#F4F1EA;border-radius:14px;padding:16px 18px;margin-top:20px;font:14px/1.6 "SF Mono",Menlo,monospace;white-space:pre-wrap}a{color:#1E5A73}</style></head>
<body><main><h1>Case logins</h1><p>Candidates you add here can sign in straight away. Passwords are shown once; copy them into the invitation.</p>
${flash ? `<div class="flash">${flash}</div>` : ''}
<div class="card"><form class="add" method="post" action="/_admin/add"><div><label for="u">Login</label><input id="u" name="user" placeholder="anna@example.com" required pattern="[A-Za-z0-9@._-]+"></div>
<div><label for="n">Note</label><input id="n" name="note" placeholder="Anna K., AI Ops, round 2"></div><div><label for="pw">Password (optional)</label><input id="pw" name="password" placeholder="generated if empty"></div><button>Add login</button></form></div>
${visitsCard()}
<div class="card"><table><thead><tr><th>Login</th><th>Created</th><th>Last seen</th><th>Activity and usage</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
<p style="margin-top:20px"><a href="/">Open the shop</a> · <a href="/admin/">Back office</a> · <a href="/logout">Sign out</a></p></main></body></html>`;
}
async function formBody(req) { let raw = ''; for await (const c of req) raw += c; return raw; }
async function adminRoute(req, res, url, user) {
  const send = (status, html) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); };
  const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body, null, 2)); };
  if (!store.users[user]?.admin) return json(403, { error: 'admins only' });
  const parts = url.pathname.split('/').slice(2).map(decodeURIComponent); // ['', ...] after /_admin
  const [a, target] = parts;
  const addUser = (u, pw, note) => {
    if (!/^[A-Za-z0-9@._-]{2,64}$/.test(u)) throw new Error('Logins can use letters, numbers, @ . _ - (2–64 characters).');
    if (store.users[u]) throw new Error(`${u} already exists.`);
    const password = pw || newPassword();
    store.users[u] = { ...hashPw(password), admin: false, note: note || '', created_at: new Date().toISOString() };
    saveStore();
    return password;
  };
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  // JSON API for the CLI (basic auth)
  if (a === 'api') {
    const [, what, u, op] = parts;
    if (what !== 'logins') return json(404, { error: 'unknown' });
    if (req.method === 'GET' && !u) return json(200, { logins: loginList() });
    if (req.method === 'GET' && u && op === 'activity') return json(200, { user: u, activity: activity(u) });
    if (req.method === 'GET' && u === 'stats' && !op) return json(200, statsSummary());
    if (req.method === 'POST' && !u) {
      let b = {};
      try { b = JSON.parse(await formBody(req) || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
      try { const password = addUser(String(b.user || '').trim(), b.password, b.note); return json(201, { user: b.user, password, url: origin }); } catch (e) { return json(400, { error: e.message }); }
    }
    if (!store.users[u]) return json(404, { error: 'no such login' });
    if (store.users[u].admin) return json(400, { error: 'admin logins are managed with the CASE_ADMIN secret' });
    if (req.method === 'DELETE' && !op) { delete store.users[u]; saveStore(); userCopies.delete(u); return json(200, { removed: u }); }
    if (req.method === 'POST' && op === 'reset') { userCopies.delete(u); return json(200, { reset: u }); }
    if (req.method === 'POST' && op === 'password') { const password = newPassword(); Object.assign(store.users[u], hashPw(password)); saveStore(); return json(200, { user: u, password }); }
    return json(404, { error: 'unknown' });
  }
  // HTML screens
  if (req.method === 'GET' && !a) return send(200, adminPage());
  if (req.method === 'GET' && a === 'activity') {
    const rows = activity(target).map(r => `<tr><td>${escHtml(r.recorded_at?.slice(0, 19).replace('T', ' '))}</td><td>${escHtml(r.kind)}</td><td><code>${escHtml(JSON.stringify({ ...r, recorded_at: undefined, sim_time: undefined, kind: undefined }))}</code></td></tr>`).join('');
    return send(200, `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(target)} · activity</title><style>${PAGE_CSS}main{max-width:1200px;margin:0 auto;padding:40px 24px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;font-size:14px}td{padding:10px;border-bottom:1px solid #E6DDCF;vertical-align:top}code{font:12px/1.5 "SF Mono",Menlo,monospace;white-space:pre-wrap;word-break:break-word}</style></head>
      <body><main><h1>${escHtml(target)}</h1><p><a href="/_admin">← Logins</a> · Everything this login changed or sent through the APIs and back office, oldest first.</p><table>${rows || '<tr><td>Nothing yet.</td></tr>'}</table></main></body></html>`);
  }
  if (req.method !== 'POST') return send(404, adminPage('Not found.'));
  const f = new URLSearchParams(await formBody(req));
  try {
    if (a === 'add') {
      const u = (f.get('user') || '').trim(), pw = addUser(u, (f.get('password') || '').trim(), (f.get('note') || '').trim());
      return send(200, adminPage(`Added ${escHtml(u)}\nURL:      ${escHtml(origin)}/admin/\nLogin:    ${escHtml(u)}\nPassword: ${escHtml(pw)}`));
    }
    if (!store.users[target] || store.users[target].admin) throw new Error('No such candidate login.');
    if (a === 'remove') { delete store.users[target]; saveStore(); userCopies.delete(target); return send(200, adminPage(`Removed ${escHtml(target)}.`)); }
    if (a === 'reset') { userCopies.delete(target); return send(200, adminPage(`Reset ${escHtml(target)}'s data to the starting point. Their activity log is kept.`)); }
    if (a === 'password') { const pw = newPassword(); Object.assign(store.users[target], hashPw(pw)); saveStore(); return send(200, adminPage(`New password for ${escHtml(target)}: ${escHtml(pw)}`)); }
  } catch (e) { return send(400, adminPage(escHtml(e.message))); }
  return send(404, adminPage('Not found.'));
}

const PUBLIC_PAGES = /^\/(?:(?:index|shop|product|how-it-works|careers)(?:\.html)?)?$/;
// Ten failed logins from one address locks it out for 15 minutes (form and HTTP basic auth alike).
const failures = new Map();
const clientIp = req => req.headers['fly-client-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
const tooMany = ip => { const f = failures.get(ip); return !!f && f.n >= 10 && f.until > Date.now(); };
const failedLogin = ip => { const f = failures.get(ip); if (!f || f.until < Date.now()) failures.set(ip, { n: 1, until: Date.now() + 15 * 60e3 }); else f.n += 1; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (!GATED && url.pathname === '/logout') { res.writeHead(303, { location: '/' }); return res.end(); }
  if (!GATED) return handle(req, res);
  res.setHeader('x-robots-tag', 'noindex, nofollow');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "frame-ancestors 'none'");
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('strict-transport-security', 'max-age=31536000');
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  if (url.pathname === '/logout') {
    res.writeHead(303, { location: '/login', 'set-cookie': `cc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}` });
    return res.end();
  }
  if (url.pathname === '/login') {
    if (req.method === 'POST') {
      const f = new URLSearchParams(await formBody(req)), ip = clientIp(req);
      if (tooMany(ip)) return sendBody(req, res, 429, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '900' }, loginPage('Too many tries. Wait 15 minutes and try again.', f.get('next') || '', f.get('user') || ''));
      const u = findUser(f.get('user')), pw = f.get('password') || '', want = f.get('next') || '';
      if (u && checkPw(u, pw)) {
        const next = /^\/(?![\/\\])[^\\\r\n]*$/.test(want) ? want : store.users[u].admin ? '/_admin' : '/admin/';
        res.writeHead(303, { location: next, 'set-cookie': `cc_session=${makeSession(u)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600${secure}` });
        return res.end();
      }
      failedLogin(ip);
      return sendBody(req, res, 401, { 'content-type': 'text/html; charset=utf-8' }, loginPage('Wrong email or password.', f.get('next') || '', f.get('user') || ''));
    }
    return sendBody(req, res, 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, loginPage('', url.searchParams.get('next') || ''));
  }
  // Careers: the shop's careers page links out through these, so the targets can change without a deploy.
  const OUT = { '/hiring': '/careers', '/apply': process.env.CASE_APPLY_URL || '/careers', '/dm': process.env.CASE_DM_URL || '/careers' };
  if (OUT[url.pathname]) { trackVisit(req, url); res.writeHead(302, { location: OUT[url.pathname] }); return res.end(); }
  if (req.method === 'GET' && (req.headers.accept || '').includes('text/html') && PUBLIC_PAGES.test(url.pathname)) trackVisit(req, url);
  const ip = clientIp(req);
  if (/^Basic /.test(req.headers.authorization || '') && tooMany(ip)) { res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '900' }); return res.end(JSON.stringify({ error: 'too many failed logins; try again in 15 minutes' })); }
  const user = userFrom(req);
  if (!user && /^Basic /.test(req.headers.authorization || '')) failedLogin(ip);
  // The shop is public, so people can share it; the back office, files and APIs need a login.
  if (!user && ['GET', 'HEAD'].includes(req.method) && (url.pathname.startsWith('/assets/') || PUBLIC_PAGES.test(url.pathname))) return handle(req, res);
  if (!user) {
    if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
      res.writeHead(302, { location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` });
      return res.end();
    }
    res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Basic realm="Ciabatta Club case"' });
    return res.end(JSON.stringify({ error: 'sign in at /login, or use HTTP basic auth with your case login' }));
  }
  lastSeen.set(user, new Date().toISOString());
  if (!store.users[user]?.admin) trackUse(user, req, url);
  if (url.pathname === '/_admin' || url.pathname.startsWith('/_admin/')) return adminRoute(req, res, url, user);
  return session.run({ user }, () => handle(req, res));
});
server.listen(PORT, () => console.log(`Ciabatta Club mock APIs on http://localhost:${PORT} (clock frozen at ${SIM_NOW})${GATED ? ` · login required (${Object.keys(store.users).length} logins)` : ''}`));
