-- Ciabatta Club case schema. Works in SQLite and Postgres/Supabase.

CREATE TABLE products (
  sku TEXT PRIMARY KEY,
  model TEXT,
  color TEXT,
  size INTEGER,
  supplier_article_name TEXT,
  retail_price_eur NUMERIC(10,2),
  wholesale_price_eur NUMERIC(10,2),
  supplier_stock INTEGER,
  stock_updated_at TIMESTAMPTZ,
  fit_note TEXT
);

CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_email TEXT,
  customer_language TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  total_eur NUMERIC(10,2),
  payment_provider TEXT,
  ship_name TEXT,
  ship_street TEXT,
  ship_line2 TEXT,
  ship_postcode TEXT,
  ship_city TEXT,
  ship_country TEXT,
  address_updated_at TIMESTAMPTZ
);

CREATE TABLE order_lines (
  order_id TEXT,
  line_no INTEGER,
  sku TEXT,
  qty INTEGER,
  unit_price_eur NUMERIC(10,2),
  lot TEXT,
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE supplier_orders (
  supplier_order_id TEXT PRIMARY KEY,
  supplier TEXT,
  order_id TEXT,
  submitted_at TIMESTAMPTZ,
  status TEXT,
  status_updated_at TIMESTAMPTZ,
  processing_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  carrier TEXT,
  tracking_number TEXT,
  supplier_note TEXT
);

CREATE TABLE tracking_events (
  event_id TEXT PRIMARY KEY,
  carrier TEXT,
  tracking_number TEXT,
  direction TEXT,
  order_id TEXT,
  event_time TIMESTAMPTZ,
  status TEXT,
  location TEXT,
  detail TEXT
);

CREATE TABLE returns (
  return_id TEXT PRIMARY KEY,
  order_id TEXT,
  line_no INTEGER,
  sku TEXT,
  reason TEXT,
  reason_detail TEXT,
  requested_at TIMESTAMPTZ,
  label_tracking TEXT,
  kade_received_at TIMESTAMPTZ,
  grade TEXT
);

CREATE TABLE payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT,
  provider TEXT,
  kind TEXT,
  amount_eur NUMERIC(10,2),
  status TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT,
  return_id TEXT,
  note TEXT
);

CREATE TABLE disputes (
  dispute_id TEXT PRIMARY KEY,
  order_id TEXT,
  provider TEXT,
  reason TEXT,
  amount_eur NUMERIC(10,2),
  opened_at TIMESTAMPTZ,
  respond_by TIMESTAMPTZ,
  status TEXT,
  fee_eur NUMERIC(10,2),
  buyer_message TEXT
);

CREATE TABLE reviews (
  review_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  order_id TEXT,
  customer_id TEXT,
  sku TEXT,
  product TEXT,
  rating INTEGER,
  title TEXT,
  body TEXT,
  language TEXT,
  verified INTEGER,
  reviewer TEXT
);

CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT,
  owner TEXT,
  title TEXT,
  tags TEXT,
  source TEXT,
  handed_over_by TEXT,
  handover_note TEXT,
  order_id TEXT,
  related_ref TEXT,
  contact_channel TEXT,
  outcome TEXT,
  minutes_spent INTEGER,
  sam_note TEXT
);

CREATE TABLE task_steps (
  task_id TEXT,
  step_no INTEGER,
  at TIMESTAMPTZ,
  actor TEXT,
  system TEXT,
  action TEXT,
  minutes NUMERIC(6,1),
  result TEXT,
  PRIMARY KEY (task_id, step_no)
);

CREATE TABLE kade_stock (
  unit_id TEXT PRIMARY KEY,
  sku TEXT,
  return_id TEXT,
  received_at TIMESTAMPTZ,
  grade TEXT,
  status TEXT,
  status_at TIMESTAMPTZ,
  bin TEXT,
  order_id TEXT
);

CREATE TABLE supplier_invoices (
  invoice_id TEXT PRIMARY KEY,
  supplier TEXT,
  invoice_date DATE,
  due_date DATE,
  total_eur NUMERIC(10,2),
  expected_total_eur NUMERIC(10,2),
  status TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  payment_scheduled_for DATE
);

CREATE TABLE supplier_invoice_lines (
  invoice_id TEXT,
  line_no INTEGER,
  supplier_order_id TEXT,
  order_id TEXT,
  sku TEXT,
  description TEXT,
  qty INTEGER,
  unit_price_eur NUMERIC(10,2),
  amount_eur NUMERIC(10,2),
  PRIMARY KEY (invoice_id, line_no)
);

CREATE TABLE conversations (
  conversation_id TEXT PRIMARY KEY,
  customer_id TEXT,
  contact_email TEXT,
  order_id TEXT,
  channel TEXT,
  language TEXT,
  topic TEXT,
  opened_at TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT,
  handled_by TEXT
);

CREATE TABLE customer_messages (
  message_id TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ,
  conversation_id TEXT,
  order_id TEXT,
  customer_id TEXT,
  channel TEXT,
  sender TEXT,
  template TEXT,
  body TEXT,
  attachments TEXT,
  trigger_event_id TEXT
);

CREATE TABLE agent_actions (
  action_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  agent TEXT,
  conversation_id TEXT,
  order_id TEXT,
  tool TEXT,
  args JSONB,
  rationale TEXT,
  status TEXT,
  review_today INTEGER,
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  decision_note TEXT,
  execution_result TEXT
);

CREATE TABLE agent_runs (
  run_id TEXT PRIMARY KEY,
  agent TEXT,
  started_at TIMESTAMPTZ,
  trigger TEXT,
  task TEXT,
  model TEXT,
  input_tokens INTEGER,
  cached_input_tokens INTEGER,
  output_tokens INTEGER,
  cost_eur NUMERIC(10,4),
  tool_calls INTEGER,
  outcome TEXT
);

CREATE TABLE integrations (
  name TEXT PRIMARY KEY,
  kind TEXT,
  owner TEXT,
  schedule TEXT,
  status TEXT,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INTEGER,
  last_error TEXT,
  alerting TEXT
);
