// Ciabatta Club back office, Approach: the first page to read.
// How Efim looked at the shop (one number to steer by, three levers), what he found, what he proposes ranked
// by money, and fix / kill / teach, with links to the tabs that hold the evidence (Impact, Plan, Handoffs).
(() => {
  const { views, esc, head } = CC;
  const E0 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur = v => E0.format(Math.round(v));

  const FOUND = [
    ['ops', '168 “as new” returned pairs sit unsold at Kade while we buy the same shoes new. Nothing resold since Sam stopped doing it by hand on 14 May.', '€2,200–16,600 a month'],
    ['biz', 'Ciabatta takes no returns back, and 40–44% of its shoes come back.', '−€37 to −€48 per Ciabatta pair kept'],
    ['biz', 'Ortensi raised prices 8% with 12 days’ notice instead of the 30 its contract requires; 3 cancelled orders billed.', '€3,747 once'],
    ['biz', 'We pay Ortensi on day 30 and never take the 2% discount for paying within 10 days.', '~€2,100 a month'],
    ['ops', 'The money agent accepts every customer dispute under €150, even when the courier shows the parcel was delivered.', '€1,195 lost in 30 days'],
    ['eff', 'Agents cost €1,306 a month; 44% is one agent asking the courier “anything new?” every 15 minutes.', '€1,256 a month'],
    ['eff', 'Questions between agents get lost in a group chat: 16 open issues, none with an owner, 7 days in the middle case.', '€4,278 at risk; a supplier credit hold'],
  ];
  const PROPOSE = [
    ['Kade-first: ship from returned stock before buying new; old Ortensi pairs back before their 60-day refund ends', 'Ops', '€2,244 / month + €3,302 once', '€16,623 / month'],
    ['Paid ads €18 → €12 per order, starting with the Ciabatta shoes', 'Elena', '—', '€13,722 / month'],
    ['Ciabatta refunds unsold returns, like Ortensi', 'Elena', '—', '€9,371 / month'],
    ['Hold Ortensi to the 30-day notice; credit for the 3 cancelled orders', 'Elena', '€3,747 once', '—'],
    ['Pay Ortensi within 10 days for the 2% discount', 'Elena', '~€2,100 / month', 'same'],
    ['Fight disputes with the courier’s delivery scan', 'Ops', '€1,195 lost last month', '€1,374 / month'],
    ['Cheaper agents: plain code, less reading, smaller models', 'Ops', '€1,256 / month', 'same'],
    ['Handoffs journal: one owner and a deadline per question', 'Ops', '€4,278 caught in time', 'protects the rows above'],
  ];
  const KFT = {
    Fix: ['Kade-first routing (built and tested)', 'File exchange with Ciabatta instead of one email per order', 'Ortensi access key renewed + alerts on every connection', 'Handoffs journal with an automatic checker'],
    Kill: ['Tina asking the courier every 15 minutes: the courier notifies us instead', 'Nora’s hourly summary: the checker replaces it', '“Accept any dispute under €150”', 'Paying an AI model to run an action a person already approved'],
    Teach: ['Paolo: refund simple returns alone, once code confirms Kade has the pair', 'Mia: no discount codes to smooth things over, no refund before Kade has the parcel, address changes reach the maker', 'Leo: an order counts as placed only when Ortensi accepts it; passwords and supplier questions go to a person'],
  };
  const TAG = { ops: ['Operations', '#C2552B'], biz: ['Business', '#B08410'], eff: ['Efficiency', '#1A73A8'] };

  views.approach = async page => {
    const [h, hd] = await Promise.all([
      fetch('impact-data.json').then(r => r.json()).catch(() => null),
      fetch('handoffs-data.json').then(r => r.json()).catch(() => null),
    ]);
    const agents = h ? Object.values(h.spend).reduce((a, s) => a + s.reduce((x, y) => x + y, 0), 0) : 1306;
    const clicks = h ? h.approvals_decided_30d : 1152;
    const open = hd ? hd.summary.open_now : 16;

    page.innerHTML = `<div class="impact plan approach">` + head('Efim’s approach', 'Covering for Sam: how I looked at the shop, what I found, and what I’d do, biggest money first. The tabs linked below hold the evidence.') + `
      <div class="card ns">
        <div class="ns__l"><span class="k">North Star metric</span>
          <h2 class="ns__h">Profit per pair the customer keeps, after ads <span class="faint">(CM3 per kept pair)</span></h2>
          <p>About 1 in 4 pairs comes back (44% of Loafers), and ads cost €18 per order, about €41,000 a month, on operations that don’t yet pay for themselves. So a sale only counts once the pair is kept, and every kept pair has to carry its share of returns and ads.</p></div>
        <div class="ns__r">
          <div class="ns__row"><span>After shoe + delivery</span><b>+€27.98</b></div>
          <div class="ns__row"><span>After returns, fees, agents, Sam</span><b>+€6.29</b></div>
          <div class="ns__row ns__neg"><span>After ads · today</span><b>−€11.11</b></div>
          <div class="ns__row ns__goal"><span>With my changes</span><b>≈ −€2.4</b></div>
          <p class="faint">per kept pair · 2,366 kept pairs a month · today ≈ −€26,000 a month</p></div>
      </div>

      <h2 class="sec-h">Three levers</h2>
      <div class="lanes3">
        <div class="card lane" style="--lane:#C2552B"><span class="k">1 · Operations</span><b>Where is the money being lost?</b>
          <p>Followed the money through orders, returns, refunds and disputes. Biggest leak: returned “as new” pairs at Kade never resold; disputes given away.</p>
          <p class="big">+€7.03 <span class="faint">per kept pair from Kade-first alone</span></p><a class="btn small" href="#/impact">How we measured it on history →</a></div>
        <div class="card lane" style="--lane:#B08410"><span class="k">2 · Business</span><b>What do the supplier contracts say?</b>
          <p>Read both makers’ terms line by line. Ortensi’s price rise broke its own notice rule; we skip its 2% discount; Ciabatta takes nothing back.</p>
          <p class="big">€3,747 <span class="faint">once + ~€2,100 a month, and Elena’s two biggest levers</span></p><a class="btn small" href="#/supplies">Supplier terms →</a></div>
        <div class="card lane" style="--lane:#1A73A8"><span class="k">3 · Efficiency</span><b>Rebuild the agent setup</b>
          <p>Small money, big relief for the one person running the shop: more plain code, fewer AI calls, and a journal so no question is lost.</p>
          <p class="big">${eur(agents)} → ~€50 <span class="faint">a month · ${open} → 0 questions without an owner · ${clicks} approval clicks → ~750</span></p><a class="btn small" href="#/handoffs">New agent setup: code + handoffs journal →</a></div>
      </div>

      <h2 class="sec-h">What we found</h2>
      <div class="card"><table class="rt found"><thead><tr><th>Lever</th><th>Finding</th><th>Money</th></tr></thead><tbody>${
        FOUND.map(([t, f, m]) => `<tr><td><span class="owner" style="background:color-mix(in oklch, ${TAG[t][1]} 14%, transparent);color:${TAG[t][1]}">${TAG[t][0]}</span></td><td>${esc(f)}</td><td class="mono">${esc(m)}</td></tr>`).join('')}</tbody></table></div>

      <h2 class="sec-h">What we propose, ranked by money</h2>
      <div class="card"><table class="rt"><thead><tr><th>#</th><th>Proposal</th><th>Who decides</th><th>Proven on real data</th><th>Estimate once running</th></tr></thead><tbody>${
        PROPOSE.map(([p, who, proven, est], i) => `<tr><td class="mono">${i + 1}</td><td>${esc(p)}</td><td><span class="owner ${who === 'Elena' ? 'o-elena' : 'o-code'}">${who}</span></td><td class="mono">${esc(proven)}</td><td class="mono"><b>${esc(est)}</b></td></tr>`).join('')}</tbody></table>
        <p class="faint" style="margin:10px 0 0;font-size:12.5px">Proven = recalculated from the shop’s real data of the last 30 days. Estimate = the shop’s profit calculator (Supplies page) with only that one change. Rows 1 and 3 overlap.</p></div>

      <h2 class="sec-h">Fix, kill, teach</h2>
      <div class="lanes3">${Object.entries(KFT).map(([k, items], i) => `<div class="card lane" style="--lane:${['#5E8A3A', '#A33A2A', '#8A4F8F'][i]}"><span class="k">${k}</span>
        <ol class="kft">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}</div>
      <p class="faint" style="margin:10px 0 0">Kept human on purpose: talking to the makers (defect claims, the strap injury case) and every price, term or partner decision (Elena).</p>

      <h2 class="sec-h">Go deeper</h2>
      <div class="lanes3 deeper">
        <a class="card lane" href="#/impact" style="--lane:#C2552B"><span class="k">Impact</span><b>How we measured the impact on history</b><p>Today vs. with the changes; switch them on and off; 30 days of real data.</p></a>
        <a class="card lane" href="#/plan" style="--lane:#5E8A3A"><span class="k">Plan</span><b>Our plan for the first two weeks</b><p>Timeline, day-by-day tasks, and the numbers to check on day 14.</p></a>
        <a class="card lane" href="#/handoffs" style="--lane:#1A73A8"><span class="k">Handoffs</span><b>New agent setup: more code + handoffs journal</b><p>16 questions that waited days with no owner, and what changes with the journal.</p></a>
      </div></div>`;
  };
})();
