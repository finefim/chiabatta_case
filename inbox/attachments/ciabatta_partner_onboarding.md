# Ciabatta partner onboarding pack

Ciabatta S.r.l. · Partner Operations · March 2026

Welcome. This pack explains how to sell Ciabatta Ultra Comfort in your shop: how we ship on your behalf and how we work together.

## 1. What we do and what you do

| | Ciabatta | Partner |
|---|---|---|
| Stock | We hold all stock in our DC in Bergamo | You never buy stock up front |
| First delivery | We dropship each order to your customer with GLS | You send us the order |
| Returns | Not accepted back at Ciabatta | You handle returns, refunds and resale |
| Customer service | — | Yours |
| Pricing | Recommended retail prices apply | You set promotions within our guidelines |

## 2. Costs

- Wholesale prices as per the price list (Ultra Comfort €36, Loafer €68, Socks €5).
- Dropship fee €6.50 per parcel.
- Weekly invoice every Monday for the previous week's parcels, **14 days net**.
- Accounts more than **7 days overdue** go on credit hold after a final written reminder: we stop shipping until the balance is cleared.

## 3. Integration

We run everything on a simple SFTP. You'll get credentials from our IT team.

| Folder | Direction | What | When |
|---|---|---|---|
| `/orders/in` | you → us | One CSV per batch of orders (spec below) | We pick up every 30 minutes |
| `/stock/out` | us → you | Full stock per SKU | Daily at 06:00 CET |
| `/tracking/out` | us → you | Order reference, parcel number, carrier | Hourly |

Order CSV columns: `partner_order_id, sku, qty, name, street, line2, postcode, city, country, email, phone`.

During your first two weeks you can email orders to orders@ciabatta.example, one per email, while the SFTP is set up. After that, email orders are processed once a day only.

## 4. Stock and availability

Our stock file is the only source of truth. We don't send individual out-of-stock emails; if an order includes an unavailable SKU, we hold the order and tell you once.

## 5. Contacts

- Partner operations: Giada Rinaldi, partners@ciabatta.example
- Orders: orders@ciabatta.example
- Accounts: accounts@ciabatta.example
- IT and SFTP: it@ciabatta.example
