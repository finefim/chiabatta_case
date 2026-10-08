// Plain-English glossary for the Impact, Plan and Handoffs tabs.
// Each of those pages gets a "What the words on this page mean" box at the bottom.
// Load this file after admin-impact.js, admin-plan.js and admin-handoffs.js.
(() => {
  const { views, esc } = CC;
  const WORDS = {
    'Kept pair': 'A pair the customer keeps. About 1 in 4 pairs comes back, so we count money per pair that stays sold, not per pair shipped.',
    'Profit per pair kept (CM3)': 'Money left from one kept pair after paying for the shoe, delivery, returns, payment fees, disputes, agents, Sam’s salary and ads. Negative = we lose money on every pair. CM3 is the finance name: “contribution margin, level 3”.',
    'CM1 / CM2': 'The same profit at earlier steps: CM1 = after the shoe and delivery only; CM2 = also after returns, payments, agents and Sam; CM3 = also after ads.',
    'Kade': 'The returns warehouse in Venlo (NL). Customers send returns there; Kade checks each pair and grades it.',
    '“As new” pair (grade A)': 'A returned pair Kade checked as perfect. We already own it and can sell it again instead of buying a new one.',
    'Kade-first routing': 'Before an order goes to the shoe maker, code checks whether Kade already has that exact shoe “as new”. If yes, Kade ships it.',
    'Ortensi’s 60-day credit': 'Ortensi refunds us the full cost of an unsold returned pair if it reaches them within 60 days of Kade’s check. After that the pair is ours to sell or write off.',
    'Proven vs. estimate': 'Proven = recalculated from the shop’s real data of the last 30 days. Estimate = what the profit calculator says once the change runs fully.',
    'Tested on last month (replay)': 'We fed last month’s real orders or messages through the new logic, in time order, to see what it would have done.',
    'Dispute / chargeback': 'A customer asks their bank or PayPal for the money back. If we don’t answer with proof (e.g. the delivery scan), we lose the money plus a €15 fee.',
    'Agent': 'An AI assistant that does one job: Mia (customers), Leo (suppliers), Tina (tracking), Paolo (money), Nora (coordination).',
    'Agent spend': 'What we pay the AI provider for the agents’ work, by the amount of text they read and write.',
    'Approval queue': 'Actions an agent proposes (a refund, a reply) that wait for a person to click “approve”.',
    'Trial week (shadow mode)': 'The agent only suggests; a person decides; we compare. If they agree every time, the agent may act alone.',
    'Can never run twice (idempotency key)': 'Each action carries a unique label, so clicking “approve” twice can’t refund the same customer twice.',
    'Webhook': 'Instead of us asking GLS “anything new?” every 15 minutes, GLS tells us the moment a parcel is scanned.',
    'File exchange (SFTP)': 'A shared folder with Ciabatta: we drop order files, they drop stock and tracking files. Replaces one email per order.',
    'Access key (API token)': 'The password our system uses to talk to Ortensi’s system. It expires every 90 days; when it did, our stock data stopped updating.',
    'Handoff': 'Any moment one agent or supplier needs someone else to do something.',
    'Handoffs journal': 'One list where every handoff gets an owner and a deadline, instead of a chat message that can be ignored.',
    'Who-owns-what table': 'A fixed table in code: topic → owner → deadline. The agent can’t pass a question to the wrong person.',
    'Automatic checker (watchdog)': 'Code that looks at the journal every 15 minutes and hands anything past its deadline to a person, with the email and history attached.',
    'Dropship': 'The maker ships straight to our customer; we never hold the stock.',
    'Wholesale price': 'What we pay the maker for a pair, before VAT.',
  };
  const PAGES = {
    approach: ['Kept pair', 'Profit per pair kept (CM3)', 'CM1 / CM2', 'Proven vs. estimate', 'Kade', '“As new” pair (grade A)', 'Kade-first routing', 'Ortensi’s 60-day credit', 'Dispute / chargeback', 'Agent', 'Agent spend', 'Approval queue', 'Handoffs journal', 'Automatic checker (watchdog)', 'Webhook', 'File exchange (SFTP)', 'Access key (API token)'],
    impact: ['Kept pair', 'Profit per pair kept (CM3)', 'CM1 / CM2', 'Proven vs. estimate', 'Tested on last month (replay)', 'Kade', '“As new” pair (grade A)', 'Kade-first routing', 'Ortensi’s 60-day credit', 'Dispute / chargeback', 'Agent spend', 'Webhook', 'File exchange (SFTP)', 'Handoffs journal', 'Dropship'],
    plan: ['Profit per pair kept (CM3)', 'Kade', '“As new” pair (grade A)', 'Kade-first routing', 'Ortensi’s 60-day credit', 'Approval queue', 'Trial week (shadow mode)', 'Can never run twice (idempotency key)', 'Webhook', 'File exchange (SFTP)', 'Access key (API token)', 'Handoffs journal', 'Automatic checker (watchdog)'],
    handoffs: ['Handoff', 'Handoffs journal', 'Who-owns-what table', 'Automatic checker (watchdog)', 'Tested on last month (replay)', 'Agent', 'Dispute / chargeback', 'Webhook', 'File exchange (SFTP)', 'Access key (API token)', 'Kade', 'Ortensi’s 60-day credit'],
  };
  const box = keys => `<details class="card gloss" style="margin-top:16px"><summary><b>What the words on this page mean</b> <span class="faint">(plain English)</span></summary>
    <dl class="kv gloss__dl">${keys.map(k => `<dt>${esc(k)}</dt><dd>${esc(WORDS[k])}</dd>`).join('')}</dl></details>`;
  for (const [name, keys] of Object.entries(PAGES)) {
    const orig = views[name];
    if (!orig) continue;
    views[name] = async (page, params) => {
      await orig(page, params);
      (page.firstElementChild || page).insertAdjacentHTML('beforeend', box(keys));
    };
  }
  CC.glossary = WORDS;
})();
