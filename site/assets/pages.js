/* Ciabatta Club storefront · page renderers: home, collection (PLP), product (PDP), how it works.
   Depends on window.CC from shop.js. */
(function () {
  // Prefer a colourway that has a real packshot.
  var withPhoto = function (m) { return m.colors.filter(function (c) { return CC.PHOTOS[m.code + '-' + c.code]; })[0] || m.colors[0]; };
  'use strict';
  var CC = window.CC, $ = CC.$, $$ = CC.$$, esc = CC.esc, eur = CC.eur, ICON = CC.ICON;
  var params = new URLSearchParams(location.search);
  var vt = function (fn) { if (document.startViewTransition && !CC.reduced) document.startViewTransition(fn); else fn(); };

  // ---------- shared bits ----------
  function viewed() { return CC.store.get(CC.VIEW_KEY, []); }
  function recordView(m, c) {
    var list = viewed().filter(function (v) { return !(v[0] === m.code && v[1] === c.code); });
    list.unshift([m.code, c.code]);
    CC.store.set(CC.VIEW_KEY, list.slice(0, 10));
  }
  function viewedRail(exclude) {
    var items = viewed().filter(function (v) { return !exclude || v[0] + v[1] !== exclude; }).map(function (v) { var m = CC.model(v[0]); return m && CC.card(m, CC.colorOf(m, v[1])); }).filter(Boolean);
    return items.length ? '<div class="section">' + CC.rail('Recently viewed', items.join(''), { id: 'rv-h', label: 'Recently viewed' }) + '</div>' : '';
  }
  function stars(avg) {
    var n = Math.round(avg || 0), out = '';
    for (var i = 1; i <= 5; i++) out += i <= n ? ICON.star : ICON.starOff;
    return '<span class="stars" aria-hidden="true">' + out + '</span>';
  }
  function whenReady(el, html, skeletonCount) {
    if (!skeletonCount || CC.reduced) { el.innerHTML = html(); return; }
    el.innerHTML = Array(skeletonCount + 1).join('<div class="card card--skeleton" aria-hidden="true"><div class="card__media"><div class="ph ph--shimmer ph--plain"></div></div><div class="card__body"><span></span><span></span><span></span></div></div>');
    el.setAttribute('aria-busy', 'true');
    setTimeout(function () { el.innerHTML = html(); el.removeAttribute('aria-busy'); CC.reveal(el); }, 220);
  }

  // ---------- home ----------
  function heroPhoto() {
    var el = $('#hero-media'); if (!el) return;
    var name = document.documentElement.dataset.hero === 'loafer' ? 'lifestyle-loafer-walk' : 'lifestyle-ultra-comfort-walk';
    el.innerHTML = CC.lifeImg(name, { eager: true, sizes: '100vw', cls: '' });
  }
  function renderHome() {
    heroPhoto();
    document.addEventListener('tweaks:change', heroPhoto);
    var best = CC.FEATURED.map(function (f) { var m = CC.model(f[0]); return m && CC.card(m, CC.colorOf(m, f[1])); }).filter(Boolean).join('');
    $('#rail-best').innerHTML = CC.rail('Best sellers', best, { id: 'best-h', label: 'Best sellers' });
    var marche = CC.MODELS.filter(function (m) { return CC.collection(m) === 'marche'; });
    $('#rail-marche').innerHTML = CC.rail('Handmade in Marche', marche.map(function (m) { return CC.card(m, withPhoto(m)); }).join(''), { id: 'marche-h', label: 'Handmade in Marche' });
    $('#rail-viewed').innerHTML = viewedRail();
    finder();
  }

  // size finder: pick a model and your usual size; the fit note decides
  function finder() {
    var root = $('#finder-app'); if (!root) return;
    var shoes = CC.MODELS.filter(function (m) { return !CC.isSocks(m); });
    var pre = CC.model(params.get('fit'));
    var st = { m: pre && !CC.isSocks(pre) ? pre.code : shoes[0].code, size: 40, between: false };
    var draw = function () {
      var m = CC.model(st.m), fit = m.fit_note || '';
      var up = /larger|half a size small/i.test(fit) && st.between;
      var size = Math.min(46, st.size + (up ? 1 : 0));
      $('#finder-controls').innerHTML =
        '<label id="fm-l">Model</label><div class="opts" role="group" aria-labelledby="fm-l">' + shoes.map(function (x) { return '<button type="button" class="opt" data-fm="' + x.code + '" aria-pressed="' + (x.code === st.m) + '">' + esc(x.name.replace('Ultra Comfort ', 'UC ')) + '</button>'; }).join('') + '</div>' +
        '<label for="fs">Your usual shoe size (EU)</label><select class="select" id="fs">' + [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map(function (s) { return '<option' + (s === st.size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<label id="fb-l">Sometimes a size up?</label><div class="opts" role="group" aria-labelledby="fb-l"><button type="button" class="opt" data-fb="0" aria-pressed="' + !st.between + '">No</button><button type="button" class="opt" data-fb="1" aria-pressed="' + st.between + '">Yes, I’m in between</button></div>';
      $('#finder-result').innerHTML = '<p class="kicker">We’d choose</p><div class="finder__size">' + size + '</div><p>' + esc(fit) + '</p>' +
        '<ul class="finder__avail">' + m.colors.map(function (c) {
          var s = c.sizes.filter(function (x) { return x.size === size; })[0] || { stock: 0 };
          return '<li><span><span class="dot" style="background:' + c.swatch + '"></span>' + esc(c.name) + '</span><span>' + (s.stock === 0 ? 'Sold out' : s.stock <= 3 ? 'Only ' + s.stock + ' left' : 'In stock') + '</span></li>';
        }).join('') + '</ul><a class="btn btn--dark" href="' + CC.pdpHref(m, m.colors[0], size) + '">Shop ' + esc(m.name) + ' in ' + size + '</a>';
    };
    root.addEventListener('click', function (e) {
      var fm = e.target.closest('[data-fm]'), fb = e.target.closest('[data-fb]');
      if (fm) st.m = fm.dataset.fm;
      if (fb) st.between = fb.dataset.fb === '1';
      if (fm || fb) draw();
    });
    root.addEventListener('change', function (e) { if (e.target.id === 'fs') { st.size = Number(e.target.value); draw(); } });
    draw();
  }

  // ---------- collection page ----------
  var TYPES = { Thong: 'Thongs', Slide: 'Slides', Loafer: 'Loafers', Socks: 'Socks' };
  function renderShop() {
    var st = {
      collection: params.get('collection') || '', type: params.get('type') || '', colors: (params.get('colors') || '').split(',').filter(Boolean),
      size: Number(params.get('size')) || 0, max: Number(params.get('max')) || 0, sort: params.get('sort') || 'featured', q: params.get('q') || '',
    };
    var all = CC.variants();
    var prices = CC.MODELS.map(function (m) { return m.retail_price_eur; });
    var maxPrice = Math.max.apply(null, prices), minPrice = Math.min.apply(null, prices);
    var colorNames = []; all.forEach(function (v) { if (colorNames.indexOf(v.c.name) < 0) colorNames.push(v.c.name); });
    var swatchOf = function (name) { return all.filter(function (v) { return v.c.name === name; })[0].c.swatch; };
    var fitsSize = function (c, size) {
      return c.sizes.some(function (s) {
        if (s.stock === 0) return false;
        if (!s.size_label) return s.size === size;
        var r = s.size_label.split(/[–-]/).map(Number); return size >= r[0] && size <= r[1];
      });
    };
    var featuredRank = function (v) { var i = CC.FEATURED.findIndex(function (f) { return f[0] === v.m.code && f[1] === v.c.code; }); return i < 0 ? 99 : i; };
    var list = function () {
      var terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
      var out = all.filter(function (v) {
        return (!st.collection || CC.collection(v.m) === st.collection) && (!st.type || v.m.type === st.type) &&
          (!st.colors.length || st.colors.indexOf(v.c.name) > -1) && (!st.size || fitsSize(v.c, st.size)) && (!st.max || v.m.retail_price_eur <= st.max) &&
          (!terms.length || terms.every(function (t) { return (v.m.name + ' ' + v.c.name + ' ' + v.c.italian + ' ' + v.m.type + ' ' + TYPES[v.m.type]).toLowerCase().indexOf(t) > -1; }));
      });
      var by = { featured: function (a, b) { return featuredRank(a) - featuredRank(b); }, 'price-asc': function (a, b) { return a.m.retail_price_eur - b.m.retail_price_eur; },
        'price-desc': function (a, b) { return b.m.retail_price_eur - a.m.retail_price_eur; }, name: function (a, b) { return (a.m.name + a.c.name).localeCompare(b.m.name + b.c.name); } }[st.sort];
      return out.sort(by);
    };
    var sync = function () {
      var p = new URLSearchParams();
      ['collection', 'type', 'q'].forEach(function (k) { if (st[k]) p.set(k, st[k]); });
      if (st.colors.length) p.set('colors', st.colors.join(','));
      if (st.size) p.set('size', st.size); if (st.max) p.set('max', st.max); if (st.sort !== 'featured') p.set('sort', st.sort);
      if (/tweaks=1/.test(location.search)) p.set('tweaks', '1');
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    };
    var heroes = {
      ultra: ['The Ultra Comfort collection', 'Ciabatta Ultra Comfort', 'A deep, cushioned footbed in a flip-flop, a loafer and a sock. Made for long, easy days.', 'lifestyle-ultra-comfort-man'],
      marche: ['The Ortensi workshop', 'Handmade in Marche', 'Leather thongs and slides from a family workshop in Porto Sant’Elpidio, since 1962.', 'lifestyle-scene-terrace'],
      Loafer: ['New this summer', 'Loafers', 'A soft suede penny loafer on the Ultra Comfort sole.', 'lifestyle-loafer-steps'],
      Socks: ['The other half of comfort', 'Socks', 'Thick ribbed cotton with a cushioned sole.', 'lifestyle-socks-bed'],
      '': ['Shop', 'Every pair', 'Shipped straight from the makers in Italy. Free delivery and free 30-day returns across Europe.', 'lifestyle-ultra-comfort-walk'],
    };
    var heroFor = function () { return heroes[st.collection] || heroes[st.type] || heroes['']; };
    var drawHero = function () {
      var h = heroFor();
      $('#plp-hero').innerHTML = '<div class="plp-hero__media">' + CC.ph({ life: h[3], eager: true, sizes: '100vw' }) + '</div>' +
        '<div class="plp-hero__copy"><p class="kicker">' + esc(st.q ? 'Search' : h[0]) + '</p><h1 class="display">' + esc(st.q ? '“' + st.q + '”' : h[1]) + '</h1><p class="lede">' + esc(h[2]) + '</p></div>';
      var pills = [['', '', 'All'], ['collection', 'ultra', 'Ultra Comfort'], ['collection', 'marche', 'Handmade in Marche']].concat(Object.keys(TYPES).map(function (t) { return ['type', t, TYPES[t]]; }));
      $('#pillnav').innerHTML = pills.map(function (p) {
        var on = p[0] === '' ? !st.collection && !st.type : st[p[0]] === p[1];
        return '<a class="pill" href="#" data-pill="' + p[0] + ':' + p[1] + '" aria-current="' + on + '">' + esc(p[2]) + '</a>';
      }).join('');
    };
    var facets = function (idp) {
      return '<div class="facet"><h3>Colour</h3><div class="facet-swatches" role="group" aria-label="Colour">' + colorNames.map(function (n) {
          var on = st.colors.indexOf(n) > -1;
          return '<button type="button" data-color-f="' + esc(n) + '" aria-pressed="' + on + '"><span class="swatch" style="background:' + swatchOf(n) + '"' + (on ? ' aria-pressed="true"' : '') + '></span>' + esc(n) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="facet"><h3>In stock in my size</h3><div class="opts" role="group" aria-label="Size">' + [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map(function (s) { return '<button type="button" class="opt" data-size-f="' + s + '" aria-pressed="' + (st.size === s) + '">' + s + '</button>'; }).join('') + '</div></div>' +
        '<div class="facet"><h3>Price</h3><label class="sr-only" for="' + idp + 'maxp">Maximum price</label><input class="range" id="' + idp + 'maxp" type="range" min="' + minPrice + '" max="' + maxPrice + '" step="5" value="' + (st.max || maxPrice) + '" data-max-f>' +
          '<div class="range-val"><span>' + eur(minPrice) + '</span><span>up to ' + eur(st.max || maxPrice) + '</span></div></div>';
    };
    var draw = function (first) {
      var items = list();
      $('#facets').innerHTML = facets('d-');
      $('#sheet-facets').innerHTML = facets('m-');
      $('#count').textContent = items.length + (items.length === 1 ? ' style' : ' styles');
      $('#sheet-apply').textContent = 'Show ' + items.length + ' result' + (items.length === 1 ? '' : 's');
      var active = st.colors.map(function (c) { return ['colors', c, c]; });
      if (st.size) active.push(['size', st.size, 'EU ' + st.size + ' in stock']);
      if (st.max) active.push(['max', st.max, 'Up to ' + eur(st.max)]);
      if (st.q) active.push(['q', st.q, '“' + st.q + '”']);
      var n = st.colors.length + (st.size ? 1 : 0) + (st.max ? 1 : 0);
      $('#filter-n').textContent = n || ''; $('#filter-n').hidden = !n;
      $('#chips').innerHTML = active.length ? active.map(function (a) { return '<span class="chip">' + esc(a[2]) + '<button type="button" data-unset="' + a[0] + ':' + esc(a[1]) + '" aria-label="Remove ' + esc(a[2]) + '">' + ICON.close + '</button></span>'; }).join('') + '<button class="chip chip--clear" type="button" data-clear>Clear all</button>' : '';
      var render = function () {
        return items.length ? items.map(function (v) { return CC.card(v.m, v.c); }).join('')
          : '<div class="grid-empty"><h2 class="display" style="font-size:36px">No pairs match</h2><p class="muted">Try another colour or size, or clear the filters.</p><button class="btn btn--dark" type="button" data-clear>Clear filters</button></div>';
      };
      var grid = $('#grid');
      if (first) whenReady(grid, render, 8); else { grid.innerHTML = render(); CC.reveal(grid); }
      sync();
    };
    var toggleColor = function (n) { var i = st.colors.indexOf(n); if (i > -1) st.colors.splice(i, 1); else st.colors.push(n); };
    $('#main').addEventListener('click', function (e) {
      var t = e.target, pill = t.closest('[data-pill]'), col = t.closest('[data-color-f]'), size = t.closest('[data-size-f]'), unset = t.closest('[data-unset]');
      if (pill) { e.preventDefault(); var kv = pill.dataset.pill.split(':'); st.collection = ''; st.type = ''; if (kv[0]) st[kv[0]] = kv[1]; drawHero(); }
      else if (col) toggleColor(col.dataset.colorF);
      else if (size) { var s = Number(size.dataset.sizeF); st.size = st.size === s ? 0 : s; }
      else if (unset) { var u = unset.dataset.unset.split(':'); if (u[0] === 'colors') st.colors = st.colors.filter(function (c) { return c !== u[1]; }); else st[u[0]] = u[0] === 'q' ? '' : 0; if (u[0] === 'q') drawHero(); }
      else if (t.closest('[data-clear]')) { st.colors = []; st.size = 0; st.max = 0; if (st.q) { st.q = ''; drawHero(); } }
      else if (t.closest('#open-filters')) { $('#sheet').classList.add('is-open'); $('#sheet-overlay').classList.add('is-open'); $('#sheet').setAttribute('aria-hidden', 'false'); setTimeout(function () { $('#sheet-close').focus(); }, 60); return; }
      else return;
      vt(function () { draw(false); });
    });
    var closeSheet = function () { $('#sheet').classList.remove('is-open'); $('#sheet-overlay').classList.remove('is-open'); $('#sheet').setAttribute('aria-hidden', 'true'); };
    $('#sheet').addEventListener('click', function (e) {
      if (e.target.closest('#sheet-close') || e.target.closest('#sheet-apply')) { closeSheet(); return; }
      var col = e.target.closest('[data-color-f]'), size = e.target.closest('[data-size-f]');
      if (col) { toggleColor(col.dataset.colorF); draw(false); }
      if (size) { var s = Number(size.dataset.sizeF); st.size = st.size === s ? 0 : s; draw(false); }
    });
    $('#sheet').addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    $('#sheet-overlay').addEventListener('click', closeSheet);
    document.addEventListener('input', function (e) {
      if (!e.target.matches('[data-max-f]')) return;
      var v = Number(e.target.value); st.max = v >= maxPrice ? 0 : v;
      $$('[data-max-f]').forEach(function (r) { if (r !== e.target) r.value = e.target.value; });
      $$('.range-val span:last-child').forEach(function (s) { s.textContent = 'up to ' + eur(st.max || maxPrice); });
      clearTimeout(draw.t); draw.t = setTimeout(function () { draw(false); }, 120);
    });
    $('#sort').value = st.sort;
    $('#sort').addEventListener('change', function (e) { st.sort = e.target.value; vt(function () { draw(false); }); });
    drawHero();
    draw(true);
  }

  // ---------- product page ----------
  var MATERIAL = {
    foam: ['material-foam', 'What it’s made of', 'Light and airy, like the bread', 'The Ultra Comfort sole is named after ciabatta, and it’s built the same way: a moulded foam full of small air pockets under a cushioned footbed. Soft where you land, springy where you push off.', 'A cutaway of the Ultra Comfort sole showing its airy foam, like ciabatta bread'],
    knit: ['material-knit', 'What it’s made of', 'Ribbed outside, terry inside', 'Each sock is knitted with a ribbed leg and soft terry loops under the foot, so it sits cushioned inside a loafer and stays put on the walk.', 'Close-up of the sock knit, ribbed outside with terry loops inside'],
  };
  function materialBlock(m) {
    var key = m.code === 'SOX' ? 'knit' : null; // the foam shot is being reshot
    if (!key) return '';
    var x = MATERIAL[key];
    return '<section class="section container" aria-labelledby="mat-h"><div class="pdp-material reveal"><img src="assets/img/' + x[0] + '-900.jpg" srcset="assets/img/' + x[0] + '-900.jpg 900w, assets/img/' + x[0] + '.jpg 1600w" sizes="(min-width: 60em) 60vw, 100vw" alt="' + x[4] + '" loading="lazy" decoding="async">' +
      '<div class="pdp-material__body"><p class="kicker">' + x[1] + '</p><h2 class="display" id="mat-h">' + x[2] + '</h2><p>' + x[3] + '</p></div></div></section>';
  }
  function reviewsBlock(m) {
    var r = m.reviews || { average: null, count: 0, latest: [] };
    var sum = r.count ? '<div class="reviews__avg">' + Number(r.average).toFixed(1) + '</div>' + stars(r.average) + '<p class="muted">Average of ' + r.count + ' review' + (r.count === 1 ? '' : 's') + ', out of 5</p>'
      : '<p class="muted">No reviews yet.</p>';
    return '<section class="section container" id="reviews" aria-labelledby="rev-h"><div class="rail__head"><h2 class="caps-title" id="rev-h">Reviews</h2></div><div class="reviews">' +
      '<div class="reviews__sum">' + sum + '</div><div class="reviews__list">' + (r.latest || []).map(function (x) {
        return '<article class="review reveal">' + stars(x.rating) + '<span class="sr-only">' + x.rating + ' out of 5</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.body) + '</p><p class="meta">' + esc(x.reviewer) + ' · ' + esc(x.date) + '</p></article>';
      }).join('') + '</div></div></section>';
  }
  function renderProduct() {
    var m = CC.model(params.get('model')) || CC.MODELS[0];
    var c = CC.colorOf(m, params.get('color'));
    var size = Number(params.get('size')) || 0;
    var settled = false; // the details settle in once, not on every size or colour change
    var root = $('#pdp-app');
    // Sticky mini add-to-bag once the main button has scrolled away (scroll-based, so fast flings can't skip it).
    var syncSticky = function () { var a = $('.atc'); if (a) $('#sticky-atc').classList.toggle('is-on', a.getBoundingClientRect().bottom < 0); };
    var ticking = false;
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; syncSticky(); }); } }, { passive: true });
    var draw = function () {
      var s = CC.stock(c), socks = CC.isSocks(m);
      var chosen = c.sizes.filter(function (x) { return x.size === size && x.stock > 0; })[0];
      if (!chosen) size = 0;
      document.title = m.name + ' · ' + c.name + ' · Ciabatta Club';
      var r = m.reviews || { count: 0 };
      var upsell = (m.code === 'ULT' || m.code === 'LOF') ? CC.socksUpsell('pdp') : '';
      var from = m.supplier === 'Ciabatta' ? 'Ciabatta in Bergamo' : 'the Ortensi workshop in Porto Sant’Elpidio';
      root.innerHTML =
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="' + CC.href('/shop') + '">Shop</a><span aria-hidden="true">/</span><a href="' + CC.href('/shop?collection=' + CC.collection(m)) + '">' + (CC.collection(m) === 'ultra' ? 'Ultra Comfort collection' : 'Handmade in Marche') + '</a><span aria-hidden="true">/</span><span aria-current="page">' + esc(m.name) + '</span></nav>' +
        '<div class="pdp"><div class="stack">' + ([0, 1, 2, 3].filter(function (i) { return CC.hasShot(m, c, i); }).map(function (i) { return CC.productShot(m, c, i, { eager: i === 0 }); }).join('') || CC.productShot(m, c, 0, { eager: true, caption: null, id: null })) + '</div>' +
        '<div class="buycard' + (settled ? '' : ' settle') + '">' +
          '<p class="kicker muted">' + esc(m.tagline) + '</p><h1 class="display" style="margin-top:10px">' + esc(m.name) + '</h1>' +
          '<div class="buycard__price"><b>' + eur(m.retail_price_eur) + '</b><span class="pill-free">+ Free delivery</span></div>' +
          (r.count ? '<a class="rating" href="#reviews">' + stars(r.average) + '<span>' + Number(r.average).toFixed(1) + ' · ' + r.count + ' reviews</span></a>' : '<p class="rating">No reviews yet</p>') +
          '<p class="buycard__desc">' + esc(m.description) + '</p>' +
          '<div class="tabhead"><span>Colour</span><span>' + esc(c.name === c.italian ? c.name : c.name + ' · ' + c.italian) + '</span></div>' +
          '<div class="colorways">' + m.colors.map(function (x) {
            return '<a href="' + CC.pdpHref(m, x, size || null) + '" data-cw="' + x.code + '" aria-label="' + esc(x.name) + '"' + (x.code === c.code ? ' aria-current="true"' : '') + '>' + CC.productShot(m, x, 0, { caption: null, id: null }) + esc(x.name) + '</a>';
          }).join('') + '</div>' +
          '<div class="tabhead" id="size-l"><span>Select size</span><span id="size-pick">' + (size ? 'EU ' + CC.sizeLabel(chosen) : socks ? 'EU shoe size' : 'EU') + '</span></div>' +
          '<div class="sizes' + (socks ? ' sizes--3' : '') + '" role="radiogroup" aria-labelledby="size-l" id="sizes">' + c.sizes.map(function (x) {
            var off = x.stock === 0;
            return '<button type="button" class="size" role="radio" data-size="' + x.size + '" aria-checked="' + (x.size === size) + '"' + (off ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(CC.sizeLabel(x) + (off ? ', sold out' : x.stock <= 3 ? ', ' + x.stock + ' left' : '')) + '">' +
              esc(CC.sizeLabel(x)) + (off ? '' : x.stock <= 3 ? '<small>' + x.stock + ' left</small>' : '') + '</button>';
          }).join('') + '</div>' +
          '<div class="fit"><span>' + esc(m.fit_note) + '</span>' + (socks ? '' : '<a href="' + CC.href('/?fit=' + m.code) + '#size-finder">Fit guide</a>') + '</div>' +
          '<div class="atc"><button class="btn btn--dark btn--lg btn--block" type="button" id="atc"' + (s.total === 0 ? ' disabled' : '') + '>' + (s.total === 0 ? 'Sold out' : size ? 'Add to bag' : 'Select a size') + '</button></div>' +
          '<div class="delivery"><p>Ships from Italy in 1–2 working days · Free returns within 30 days</p>' + (socks ? '<p>Socks can’t be returned once worn.</p>' : '') + '</div>' +
          upsell +
          '<div class="acc"><details><summary>Materials</summary><div class="acc__body"><p>' + esc(m.material) + '</p></div></details>' +
            '<details><summary>Delivery and returns</summary><div class="acc__body"><p>Your order ships from ' + from + ' with GLS: 2–4 working days across Europe, a day longer to the Nordics.</p>' +
              '<p>Returns are free for 30 days' + (socks ? ' (unworn socks only)' : '') + '. They go to our returns hub in Venlo, and we refund within 3 working days of the check. <a href="' + CC.href('/how-it-works') + '">How it works</a></p></div></details></div>' +
        '</div></div>';
      $('#pdp-below').innerHTML = materialBlock(m) + reviewsBlock(m) +
        '<div class="section">' + CC.rail('Pairs well with', pairs(m).map(function (x) { return CC.card(x, withPhoto(x)); }).join(''), { id: 'pw-h', label: 'Pairs well with' }) + '</div>' + viewedRail(m.code + c.code);
      $('#sticky-atc').innerHTML = '<div class="sticky-atc__txt">' + esc(m.name) + '<span>' + esc(c.name) + ' · ' + (size ? 'EU ' + CC.sizeLabel(chosen) : 'choose a size') + ' · ' + eur(m.retail_price_eur) + '</span></div><button class="btn btn--dark" type="button" data-sticky-atc>' + (size ? 'Add to bag' : 'Select a size') + '</button>';
      CC.initRails($('#pdp-below')); CC.reveal($('#pdp-below'));
      syncSticky();
      var p = new URLSearchParams(location.search); p.set('model', m.code); p.set('color', c.code); if (size) p.set('size', size); else p.delete('size');
      history.replaceState(null, '', location.pathname + '?' + p);
      settled = true;
    };
    var pairs = function (mm) {
      var order = CC.collection(mm) === 'ultra' ? ['LOF', 'SOX', 'ULT', 'CAP', 'AMA', 'POS'] : ['ULT', 'CAP', 'AMA', 'POS', 'ISC', 'POR', 'LOF'];
      return order.filter(function (code) { return code !== mm.code; }).map(CC.model).filter(Boolean);
    };
    var add = function () {
      var btn = $('#atc');
      if (!size) { var g = $('#sizes'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); $('#size-pick').textContent = 'Choose a size first'; var f = g.querySelector('[role="radio"]:not([aria-disabled])'); if (f) f.focus(); return; }
      btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span><span>Adding</span>';
      setTimeout(function () {
        CC.addToBag(m.code, c.code, size);
        btn.disabled = false; btn.classList.add('is-added'); btn.innerHTML = ICON.check + '<span>Added</span>';
        setTimeout(function () { btn.classList.remove('is-added'); btn.textContent = 'Add to bag'; }, 1600);
      }, CC.reduced ? 0 : 420);
    };
    root.addEventListener('click', function (e) {
      var sz = e.target.closest('[data-size]'), cw = e.target.closest('[data-cw]'), sock = e.target.closest('[data-sock]');
      if (sz && sz.getAttribute('aria-disabled') !== 'true') { size = Number(sz.dataset.size); draw(); var b = $('#sizes [aria-checked="true"]'); if (b) b.focus(); }
      else if (cw && !e.metaKey && !e.ctrlKey) { e.preventDefault(); c = CC.colorOf(m, cw.dataset.cw); vt(draw); recordView(m, c); }
      else if (e.target.closest('#atc')) add();
      else if (sock) { CC.addToBag('SOX', 'OAT', Number(sock.dataset.sock)); CC.toast('Socks added'); }
    });
    root.addEventListener('keydown', function (e) {
      var cur = e.target.closest('[role="radio"]'); if (!cur || ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var all = $$('#sizes [role="radio"]:not([aria-disabled])'), i = all.indexOf(cur) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
      var next = all[(i + all.length) % all.length]; size = Number(next.dataset.size); draw(); $('#sizes [aria-checked="true"]').focus();
    });
    $('#sticky-atc').addEventListener('click', function (e) { if (e.target.closest('[data-sticky-atc]')) { if (size) add(); else $('#sizes').scrollIntoView({ behavior: CC.reduced ? 'auto' : 'smooth', block: 'center' }); } });
    recordView(m, c);
    draw();
  }

  // ---------- how it works ----------
  function renderHow() {
    var links = $$('.toc a');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id); }); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.prose section').forEach(function (s) { io.observe(s); });
  }

  var page = document.body.dataset.page;
  CC.boot({ home: renderHome, shop: renderShop, product: renderProduct, how: renderHow }[page]);
})();
