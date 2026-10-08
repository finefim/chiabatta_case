/* Ciabatta Club storefront · core: catalogue helpers, chrome (header, search, bag, bottom nav,
   footer), product cards, carousels and small motion helpers. Page renderers live in pages.js.
   Vanilla JS, no network. Catalogue and stock come from window.CATALOG (assets/catalog.js). */
(function () {
  'use strict';
  var CAT = window.CATALOG || { models: [] };
  var MODELS = CAT.models;
  var BAG_KEY = 'cc_bag_v2', VIEW_KEY = 'cc_viewed', RECENT_KEY = 'cc_recent_q';
  var CHECKOUT_OFF = 'Checkout is switched off in this case: nothing is charged, sent or stored.';
  // Real packshots. Colourways without one fall back to a tinted placeholder keyed to SHOT_LIST.md.
  var PHOTOS = {};
  var ULTRA_CODES = ['ULT', 'LOF', 'SOX']; // studio packshots on white; the Marche line is shot full-bleed on linen
  [['ULT-SND', 'ultra-comfort-sand'], ['ULT-BLK', 'ultra-comfort-black'], ['ULT-WHT', 'ultra-comfort-white'],
    ['LOF-SND', 'ultra-comfort-loafer-sand'], ['LOF-TPE', 'ultra-comfort-loafer-taupe'], ['LOF-NAV', 'ultra-comfort-loafer-navy'],
    ['SOX-OAT', 'ultra-comfort-socks-oat'], ['SOX-BLK', 'ultra-comfort-socks-black'], ['SOX-GRY', 'ultra-comfort-socks-grey'],
    ['CAP-BLK', 'capri-black'], ['CAP-WHT', 'capri-white'], ['CAP-NAV', 'capri-navy'],
    ['AMA-NAT', 'amalfi-natural'], ['AMA-BLK', 'amalfi-black'], ['AMA-COG', 'amalfi-cognac'],
    ['POS-TAN', 'positano-tan'], ['POS-OLV', 'positano-olive'], ['ISC-BLK', 'ischia-black'], ['ISC-CRM', 'ischia-cream'],
    ['POR-SND', 'portofino-sand'], ['POR-BRN', 'portofino-brown'],
  ].forEach(function (p) { PHOTOS[p[0]] = { src: 'assets/img/' + p[1] + '-900.jpg', large: 'assets/img/' + p[1] + '.jpg', cover: ULTRA_CODES.indexOf(p[0].slice(0, 3)) < 0 }; });
  // Lifestyle photography: name -> [focal point, alt text]. 1600px originals plus -900 copies.
  var LIFE = {
    'lifestyle-ultra-comfort-walk': ['72% 72%', 'Sand Ultra Comfort flip-flops walking on warm stone by the sea'],
    'lifestyle-ultra-comfort-man': ['52% 55%', 'A man in a linen shirt on a stone wall above the coast, wearing Ultra Comfort flip-flops'],
    'lifestyle-loafer-walk': ['66% 45%', 'A woman in white linen walking a lane under lemon trees in sand Ultra Comfort loafers'],
    'lifestyle-loafer-steps': ['50% 62%', 'Sand Ultra Comfort loafers on sunlit stone steps beside an olive tree'],
    'lifestyle-loafer-detail': ['45% 55%', 'Close-up of a sand suede loafer on knit and linen'],
    'lifestyle-socks-bed': ['45% 62%', 'Oat Ultra Comfort socks on a linen bed in morning light'],
    'lifestyle-scene-stairs': ['72% 40%', 'Whitewashed stairs leading down to the sea'],
    'lifestyle-scene-terrace': ['35% 55%', 'A lemon-tree terrace with a linen armchair and a view of the sea'],
  };
  var GALLERY = { 'ULT-SND': ['lifestyle-ultra-comfort-walk', 'lifestyle-ultra-comfort-man'], 'LOF-SND': ['lifestyle-loafer-walk', 'lifestyle-loafer-steps', 'lifestyle-loafer-detail'], 'SOX-OAT': ['lifestyle-socks-bed', 'lifestyle-loafer-detail'] };
  function lifeImg(name, o) {
    o = o || {};
    var f = LIFE[name] || ['50% 50%', ''];
    return '<img class="' + (o.cls || 'ph__img') + '" src="assets/img/' + name + '-900.jpg" srcset="assets/img/' + name + '-900.jpg 900w, assets/img/' + name + '.jpg 1600w" sizes="' + (o.sizes || '(min-width: 60em) 50vw, 100vw') + '"' +
      ' alt="' + (o.decorative ? '' : f[1]) + '" style="object-position:' + f[0] + '"' + (o.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  }
  var ULTRA = ['ULT', 'LOF', 'SOX']; // the flagship Ciabatta Ultra Comfort line; the rest is "Handmade in Marche"
  var FEATURED = [['ULT', 'SND'], ['LOF', 'SND'], ['SOX', 'OAT'], ['CAP', 'BLK'], ['AMA', 'COG'], ['POS', 'TAN'], ['ISC', 'CRM'], ['POR', 'SND']];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var eur = function (n) { return '€' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); };
  var store = {
    get: function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ICON = {
    search: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bag: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    home: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z"/></svg>',
    grid: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    truck: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    menu: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    key: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    starOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  };

  // ---------- catalogue ----------
  function model(code) { return MODELS.filter(function (m) { return m.code === code; })[0]; }
  function colorOf(m, c) { return m.colors.filter(function (x) { return x.code === c; })[0] || m.colors[0]; }
  function variants() {
    var out = [];
    MODELS.forEach(function (m) { m.colors.forEach(function (c) { out.push({ m: m, c: c }); }); });
    return out;
  }
  function stock(c) {
    var low = [], out = [], total = 0;
    c.sizes.forEach(function (s) { total += s.stock; if (s.stock === 0) out.push(s.size); else if (s.stock <= 3) low.push(s.size); });
    return { low: low, out: out, total: total };
  }
  function stockLine(c) {
    var s = stock(c);
    if (s.total === 0) return 'Sold out';
    if (s.low.length) return 'Only a few left in ' + c.sizes.filter(function (x) { return s.low.indexOf(x.size) > -1; }).slice(0, 3).map(sizeLabel).join(', ');
    return '';
  }
  function collection(m) { return ULTRA.indexOf(m.code) > -1 ? 'ultra' : 'marche'; }
  function isSocks(m) { return m.type === 'Socks'; }
  function sizeLabel(s) { return s.size_label || String(s.size); }
  function sizeText(m, size) { var x = m.colors[0].sizes.filter(function (s) { return s.size === Number(size); })[0]; return 'EU ' + (x ? sizeLabel(x) : size); }
  function pdpHref(m, c, size) { return href('/product?model=' + m.code + '&color=' + c.code + (size ? '&size=' + size : '')); }
  function href(url) {
    if (!/tweaks=1/.test(location.search)) return url;
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'tweaks=1';
  }

  // ---------- placeholders and photos ----------
  function rgb(hex) { hex = hex.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function mix(hex, into, amount) {
    var a = rgb(hex), b = rgb(into);
    return 'rgb(' + a.map(function (v, i) { return Math.round(b[i] + (v - b[i]) * amount); }).join(',') + ')';
  }
  function dark(hex) { var c = rgb(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.42; }
  function shotId(m, c, i) { return 'CC-P-' + m.code + '-' + c.code + '-0' + (i + 1); }
  var ANGLES = ['top-down on natural linen', 'on bare feet on warm stone steps', 'close-up of the strap and stitching', 'sole and side profile'];
  // ph({ swatch, mix, id, caption, photo, cover, cls, chip }) -> HTML for a tinted placeholder or a real photo
  function ph(o) {
    var photo = o.photo;
    var bgMix = o.mix == null ? 0.22 : o.mix;
    var bg = photo ? '' : mix(o.swatch || '#cfc6b8', '#f1f0ec', bgMix);
    var isDark = !photo && dark(o.swatch || '#cfc6b8') && bgMix > 0.5;
    var cls = 'ph' + (photo ? ' ph--photo' : '') + (o.cover ? ' ph--cover' : '') + (isDark ? ' ph--dark' : '') + (o.chip === false ? ' ph--plain' : '') + (o.cls ? ' ' + o.cls : '');
    var style = (bg ? '--ph-bg:' + bg + ';' : '') + (o.swatch ? '--ph-swatch:' + o.swatch + ';' : '') + (o.style || '');
    if (o.life) return '<div class="ph ph--photo ph--cover ph--life' + (o.cls ? ' ' + o.cls : '') + '">' + lifeImg(o.life, o) + '</div>';
    return '<div class="' + cls + '" style="' + style + '"' + (o.vt ? ' data-vt="1"' : '') + '>' +
      (photo ? '<img class="ph__img" src="' + esc(photo) + '" alt="' + esc(o.alt || '') + '"' + (o.eager ? '' : ' loading="lazy"') + ' decoding="async">' : '') +
      '<span class="ph__chip" aria-hidden="true"></span>' +
      (o.id ? '<span class="ph__id" aria-hidden="true">' + esc(o.id) + '</span>' : '') +
      (o.caption ? '<span class="ph__cap">PHOTO · ' + esc(o.caption) + '</span>' : '') + '</div>';
  }
  function hasShot(m, c, i) { return i === 0 ? !!PHOTOS[m.code + '-' + c.code] : !!(GALLERY[m.code + '-' + c.code] || [])[i - 1]; }
  function productShot(m, c, i, extra) {
    var life = i > 0 && (GALLERY[m.code + '-' + c.code] || [])[i - 1];
    if (life) return ph(Object.assign({ life: life, sizes: '(min-width: 60em) 35vw, 100vw' }, extra || {}));
    var p = i === 0 && PHOTOS[m.code + '-' + c.code];
    return ph(Object.assign({
      swatch: c.swatch, id: shotId(m, c, i), photo: p && p.src, cover: p && p.cover, alt: m.name + ' in ' + c.name,
      caption: m.name + ' ' + c.italian + ' · ' + ANGLES[i],
    }, extra || {}));
  }

  // ---------- product card ----------
  function card(m, c, opts) {
    opts = opts || {};
    var line = stockLine(c), s = stock(c);
    return '<article class="card reveal" data-model="' + m.code + '" data-color="' + c.code + '">' +
      '<a class="card__link" href="' + pdpHref(m, c) + '" aria-label="' + esc(m.name + ', ' + c.name + ', ' + eur(m.retail_price_eur)) + '">' +
        '<div class="card__media">' + mediaHTML(m, c) + '</div>' +
        '<div class="card__body"><div class="card__top"><span class="card__name">' + esc(m.name) + '</span><span class="card__price">' + eur(m.retail_price_eur) + '</span></div>' +
          '<span class="card__sub" data-sub>' + esc(c.name + ' · ' + m.tagline) + '</span>' + cardRating(m) + '</div></a>' +
      '<div class="card__body" style="padding-top:0"><div class="swatches" role="group" aria-label="Colours">' + m.colors.map(function (x) {
        return '<button class="swatch-btn" type="button" data-swatch="' + x.code + '" aria-label="' + esc(x.name) + '"><span class="swatch" style="background:' + x.swatch + '"' + (x.code === c.code ? ' aria-current="true"' : '') + '></span></button>';
      }).join('') + '</div><span class="card__stock" data-stock>' + esc(line) + '</span></div>' +
      (opts.quick === false || s.total === 0 ? '' : '<div class="quick"><button class="quick__open" type="button" aria-expanded="false">Quick add</button><div class="quick__panel" role="group" aria-label="Choose a size"></div></div>') +
      '</article>';
  }
  function cardRating(m) {
    var r = m.reviews || {};
    if (!r.count) return '';
    var n = Math.round(r.average), out = '';
    for (var i = 1; i <= 5; i++) out += i <= n ? ICON.star : ICON.starOff;
    return '<span class="card__rating" aria-label="Rated ' + Number(r.average).toFixed(1) + ' out of 5 from ' + r.count + ' reviews"><span class="stars" aria-hidden="true">' + out + '</span><span>' + Number(r.average).toFixed(1) + ' (' + r.count + ')</span></span>';
  }
  function mediaHTML(m, c) {
    var s = stock(c), hover = (GALLERY[m.code + '-' + c.code] || [])[0];
    return productShot(m, c, 0) + (hover ? lifeImg(hover, { cls: 'card__hover', sizes: '(min-width: 60em) 25vw, 50vw', decorative: true }) : '') +
      '<div class="card__badges">' + (s.total === 0 ? '<span class="badge badge--out">Sold out</span>' : (m.code === 'CAP' && c.code === 'BLK' ? '<span class="badge">Bestseller</span>' : m.code === 'LOF' ? '<span class="badge">New</span>' : '')) + '</div>';
  }
  function setCardColor(el, code) {
    var m = model(el.dataset.model), c = colorOf(m, code);
    if (el.dataset.color === c.code) return;
    el.dataset.color = c.code;
    var media = $('.card__media', el);
    media.innerHTML = mediaHTML(m, c);
    media.classList.remove('is-swap'); void media.offsetWidth; media.classList.add('is-swap');
    $('[data-sub]', el).textContent = c.name + ' · ' + m.tagline;
    $('[data-stock]', el).textContent = stockLine(c);
    $('.card__link', el).href = pdpHref(m, c);
    $$('.swatch', el).forEach(function (s) { s.toggleAttribute('aria-current', s.parentNode.dataset.swatch === c.code); });
    closeQuick(el);
  }
  function quickSizes(el) {
    var m = model(el.dataset.model), c = colorOf(m, el.dataset.color);
    return '<div class="quick__head"><span>' + esc(c.name) + ' · choose a size</span><button type="button" data-quick-close aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="quick__sizes' + (isSocks(m) ? ' quick__sizes--3' : '') + '">' + c.sizes.map(function (s) {
        var label = sizeLabel(s) + (s.stock === 0 ? ', sold out' : s.stock <= 3 ? ', ' + s.stock + ' left' : '');
        return '<button type="button" data-size="' + s.size + '" aria-label="' + label + '"' + (s.stock === 0 ? ' disabled' : '') + (s.stock > 0 && s.stock <= 3 ? ' class="low"' : '') + '>' + sizeLabel(s) + '</button>';
      }).join('') + '</div>';
  }
  function closeQuick(el) { var q = $('.quick', el); if (q) { q.classList.remove('is-open'); $('.quick__open', q).setAttribute('aria-expanded', 'false'); } }
  function bindCards(root) {
    root.addEventListener('mouseover', function (e) { var b = e.target.closest('[data-swatch]'); if (b) setCardColor(b.closest('.card'), b.dataset.swatch); });
    root.addEventListener('focusin', function (e) { var b = e.target.closest('[data-swatch]'); if (b) setCardColor(b.closest('.card'), b.dataset.swatch); });
    root.addEventListener('click', function (e) {
      var sw = e.target.closest('[data-swatch]'), open = e.target.closest('.quick__open'), size = e.target.closest('.quick__sizes [data-size]');
      var el = e.target.closest('.card');
      if (sw) { location.href = $('.card__link', el).href; return; }
      if (open) { var q = open.parentNode; q.querySelector('.quick__panel').innerHTML = quickSizes(el); q.classList.add('is-open'); open.setAttribute('aria-expanded', 'true'); if (e.detail === 0) { var f = $('.quick__sizes button:not([disabled])', q); if (f) f.focus(); } return; }
      if (e.target.closest('[data-quick-close]')) { closeQuick(el); return; }
      if (size) { addToBag(el.dataset.model, el.dataset.color, Number(size.dataset.size)); closeQuick(el); }
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var el = e.target.closest('.card'); if (el) closeQuick(el); } });
    root.addEventListener('mouseleave', function (e) { if (e.target.classList && e.target.classList.contains('card')) closeQuick(e.target); }, true);
  }

  // ---------- carousels ----------
  function rail(title, items, opts) {
    opts = opts || {};
    return '<section class="rail ' + (opts.cls || '') + '" aria-labelledby="' + opts.id + '"><div class="container rail__head"><h2 class="caps-title" id="' + opts.id + '">' + title + '</h2>' +
      '<div class="rail__nav"><button class="circle-btn" type="button" data-rail="-1" aria-label="Previous">' + ICON.left + '</button><button class="circle-btn" type="button" data-rail="1" aria-label="Next">' + ICON.right + '</button></div></div>' +
      '<div class="rail__track" tabindex="0" aria-label="' + esc(opts.label || 'Products') + '">' + items + '</div></section>';
  }
  function initRails(root) {
    $$('.rail', root).forEach(function (r) {
      if (r.dataset.ready) return; r.dataset.ready = '1';
      var track = $('.rail__track', r), prev = $('[data-rail="-1"]', r), next = $('[data-rail="1"]', r);
      var sync = function () { prev.disabled = track.scrollLeft < 8; next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8; };
      $$('[data-rail]', r).forEach(function (b) { b.addEventListener('click', function () { track.scrollBy({ left: Number(b.dataset.rail) * track.clientWidth * 0.8, behavior: reduced ? 'auto' : 'smooth' }); }); });
      track.addEventListener('scroll', sync, { passive: true });
      addEventListener('resize', sync);
      sync();
      // drag to scroll with a fine pointer; a drag never counts as a click
      var down = null, moved = false;
      track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return; down = { x: e.clientX, left: track.scrollLeft }; moved = false; });
      addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - down.x;
        if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-dragging'); }
        if (moved) track.scrollLeft = down.left - dx;
      });
      addEventListener('pointerup', function () { if (!down) return; down = null; setTimeout(function () { track.classList.remove('is-dragging'); }, 0); });
      track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    });
  }

  // ---------- reveal ----------
  function reveal(root) {
    var els = $$('.reveal:not(.is-in)', root);
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.setProperty('--delay', Math.min(20 + batch++ * 45, 250) + 'ms');
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  // ---------- bag ----------
  var bag = store.get(BAG_KEY, []);
  function bagCount() { return bag.reduce(function (n, i) { return n + i.qty; }, 0); }
  function saveBag() { store.set(BAG_KEY, bag); $$('.bag-count').forEach(function (b) { b.textContent = bagCount() || ''; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }); }
  function addToBag(mc, cc, size) {
    var m = model(mc), c = colorOf(m, cc);
    var sku = m.code + '-' + c.code + '-' + size;
    var line = bag.filter(function (i) { return i.sku === sku; })[0];
    if (line) line.qty += 1; else bag.push({ sku: sku, model: m.code, color: c.code, size: size, qty: 1 });
    if ($('#bag') && $('#bag').classList.contains('is-open')) { saveBag(); openBag(); return; }
    var from = $('.card[data-model="' + m.code + '"][data-color="' + c.code + '"] .card__media img') || $('.pdp .stack img');
    flyToBag(from, function () { saveBag(); openBag(); });
  }
  function flyToBag(img, done) {
    var to = $('[data-open-bag]');
    if (reduced || !img || !to || !img.animate) return done();
    var a = img.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width || a.bottom < 0 || a.top > innerHeight) return done();
    var ghost = img.cloneNode();
    ghost.removeAttribute('loading'); ghost.removeAttribute('srcset'); ghost.className = 'fly-ghost'; ghost.alt = '';
    ghost.style.cssText = 'left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px';
    document.body.appendChild(ghost);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), k = 34 / Math.max(a.width, a.height);
    ghost.animate([
      { transform: 'translate(0, 0) scale(1)', borderRadius: '18px', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px, ' + (dy * 0.5 - 70) + 'px) scale(' + (k + (1 - k) * 0.35) + ')', borderRadius: '40%', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')', borderRadius: '50%', opacity: 0.3 },
    ], { duration: 640, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' }).onfinish = function () { ghost.remove(); done(); };
  }
  function renderBag() {
    var body = $('#bag-body'), foot = $('#bag-foot');
    $('#bag-title').textContent = 'Bag' + (bagCount() ? ' (' + bagCount() + ')' : '');
    if (!bag.length) {
      body.innerHTML = '<div class="bag-empty"><p class="muted">Your bag is empty.</p><a class="btn btn--dark" href="' + href('/shop') + '">Shop the collection</a></div>';
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    var total = 0;
    body.innerHTML = bag.map(function (i, n) {
      var m = model(i.model), c = colorOf(m, i.color);
      total += m.retail_price_eur * i.qty;
      return '<div class="line"><a href="' + pdpHref(m, c, i.size) + '">' + productShot(m, c, 0, { caption: null, id: null, chip: !PHOTOS[m.code + '-' + c.code] }) + '</a>' +
        '<div><div class="line__name">' + esc(m.name) + '</div><div class="line__meta">' + esc(c.name) + ' · ' + sizeText(m, i.size) + '</div>' +
        '<div class="stepper" role="group" aria-label="Quantity"><button type="button" data-qty="-1" data-i="' + n + '" aria-label="One fewer">−</button><span aria-live="polite">' + i.qty + '</span><button type="button" data-qty="1" data-i="' + n + '" aria-label="One more">+</button></div>' +
        '<button class="line__remove" type="button" data-remove="' + n + '">Remove</button></div>' +
        '<div class="line__price">' + eur(m.retail_price_eur * i.qty) + '</div></div>';
    }).join('');
    var hasShoes = bag.some(function (i) { return i.model !== 'SOX'; }), hasSocks = bag.some(function (i) { return i.model === 'SOX'; });
    if (hasShoes && !hasSocks && model('SOX')) body.insertAdjacentHTML('beforeend', socksUpsell('bag'));
    $('#bag-total').textContent = eur(total);
    $('#bag-notice').hidden = true;
  }
  function socksUpsell(where) {
    var m = model('SOX'); if (!m) return '';
    var c = colorOf(m, 'OAT');
    return '<div class="upsell" data-upsell="' + where + '"><a class="upsell__img" href="' + pdpHref(m, c) + '">' + productShot(m, c, 0, { caption: null, id: null }) + '</a>' +
      '<div><p class="upsell__title">Complete it with socks</p><p class="muted">' + esc(m.name) + ' · ' + esc(c.name) + ' · ' + eur(m.retail_price_eur) + '</p>' +
      '<div class="upsell__sizes" role="group" aria-label="Add socks in size">' + c.sizes.map(function (s) {
        return '<button type="button" data-sock="' + s.size + '"' + (s.stock === 0 ? ' disabled' : '') + '>' + sizeLabel(s) + '</button>';
      }).join('') + '</div></div></div>';
  }
  var lastFocus = null;
  function openBag() {
    renderBag();
    lastFocus = document.activeElement;
    $('#bag').classList.add('is-open'); $('#bag-overlay').classList.add('is-open');
    $('#bag').setAttribute('aria-hidden', 'false');
    setTimeout(function () { $('#bag-close').focus(); }, 60);
  }
  function closeBag() {
    $('#bag').classList.remove('is-open'); $('#bag-overlay').classList.remove('is-open');
    $('#bag').setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    else if ($('[data-open-bag]')) $('[data-open-bag]').focus();
  }
  function trapFocus(panel, e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), input, select', panel).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); if (t.parentNode !== document.body) document.body.appendChild(t); // above the bag's scrim
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  // ---------- search ----------
  var INDEX = variants().map(function (v) {
    return { m: v.m, c: v.c, text: (v.m.name + ' ' + v.c.name + ' ' + v.c.italian + ' ' + v.m.type + ' ' + v.m.tagline).toLowerCase() };
  });
  var SUGGEST = MODELS.map(function (m) { return m.name; }).concat(['Thongs', 'Slides', 'Loafers', 'Socks', 'Black', 'Sand', 'White', 'Leather']);
  function hl(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function searchResults(q) {
    q = (q || '').trim().toLowerCase();
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = terms.length ? INDEX.filter(function (x) { return terms.every(function (t) { return x.text.indexOf(t) > -1; }); }) : [];
    var sugg = q ? SUGGEST.filter(function (s) { return s.toLowerCase().indexOf(q) > -1; }).slice(0, 4) : [];
    return { q: q, hits: hits.slice(0, 6), sugg: sugg };
  }
  function searchHTML(q, idp) {
    var r = searchResults(q), html = '', n = 0;
    var opt = function (inner, url, val) { return '<a class="search-opt" role="option" id="' + idp + (n++) + '" href="' + url + '" data-q="' + esc(val) + '" aria-selected="false">' + inner + '</a>'; };
    if (!r.q) {
      var recent = store.get(RECENT_KEY, []);
      if (recent.length) html += '<h3>Recent searches <button type="button" data-clear-recent>Clear</button></h3>' + recent.map(function (s) { return opt('<span>' + esc(s) + '</span>', href('/shop?q=' + encodeURIComponent(s)), s); }).join('');
      html += '<h3>Popular</h3>' + FEATURED.slice(0, 4).map(function (f) { var m = model(f[0]), c = colorOf(m, f[1]); return opt(dotFor(m, c) + '<span><b>' + esc(m.name) + '</b> <span class="meta">' + esc(c.name) + '</span></span><span class="price">' + eur(m.retail_price_eur) + '</span>', pdpHref(m, c), m.name); }).join('');
      return html;
    }
    if (r.sugg.length) html += '<h3>Suggestions</h3>' + r.sugg.map(function (s) { return opt('<span>' + hl(s, r.q) + '</span>', href('/shop?q=' + encodeURIComponent(s)), s); }).join('');
    if (r.hits.length) html += '<h3>Products</h3>' + r.hits.map(function (x) { return opt(dotFor(x.m, x.c) + '<span><b>' + hl(x.m.name, r.q) + '</b> <span class="meta">' + hl(x.c.name, r.q) + '</span></span><span class="price">' + eur(x.m.retail_price_eur) + '</span>', pdpHref(x.m, x.c), r.q); }).join('');
    html += opt('See all results for “' + esc(r.q) + '”', href('/shop?q=' + encodeURIComponent(r.q)), r.q);
    if (!r.hits.length && !r.sugg.length) html = '<p class="search-empty">No flip-flops match “' + esc(r.q) + '”. Try a model or a colour.</p>' + html;
    return html;
  }
  function dotFor(m, c) {
    var p = PHOTOS[m.code + '-' + c.code];
    return '<span class="dot" style="background:' + (p ? '#f3f0ea url(' + p.src + ') center/contain no-repeat' : mix(c.swatch, '#f1f0ec', 0.4)) + '"></span>';
  }
  function remember(q) { q = (q || '').trim(); if (!q) return; var r = store.get(RECENT_KEY, []).filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); }); r.unshift(q); store.set(RECENT_KEY, r.slice(0, 5)); }
  function combobox(input, panel, idp, onPlace) {
    var active = -1;
    var opts = function () { return $$('[role="option"]', panel); };
    var draw = function () { panel.innerHTML = searchHTML(input.value, idp); active = -1; input.removeAttribute('aria-activedescendant'); };
    var open = function () { draw(); if (onPlace) onPlace(); panel.classList.add('is-open'); input.setAttribute('aria-expanded', 'true'); };
    var close = function () { panel.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); };
    var move = function (d) {
      var o = opts(); if (!o.length) return;
      active = (active + d + o.length) % o.length;
      o.forEach(function (x, i) { x.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', o[active].id);
      o[active].scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('focus', open);
    input.addEventListener('input', function () { draw(); panel.classList.add('is-open'); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Escape') { close(); input.blur(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var o = opts()[active];
        remember(o ? o.dataset.q : input.value);
        go(o ? o.href : href('/shop?q=' + encodeURIComponent(input.value.trim())));
      }
    });
    panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-clear-recent]')) { store.set(RECENT_KEY, []); draw(); return; }
      var o = e.target.closest('[role="option"]'); if (o) remember(o.dataset.q);
    });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    return { open: open, close: close };
  }

  // ---------- navigation feel ----------
  function go(url) { progress(); location.href = url; }
  function progress() { var p = $('#nav-progress'); if (p) { p.classList.remove('is-on'); void p.offsetWidth; p.classList.add('is-on'); } }
  function bindNav() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target || a.hasAttribute('download') || a.getAttribute('href').charAt(0) === '#') return;
      if (a.origin && a.origin !== location.origin && location.protocol !== 'file:') return;
      var media = a.closest('.card') && $('.card__media .ph', a.closest('.card'));
      if (media && document.startViewTransition !== undefined) media.style.viewTransitionName = 'product-hero';
      progress();
    });
    addEventListener('pageshow', function () { var p = $('#nav-progress'); if (p) p.classList.remove('is-on'); $$('[style*="product-hero"]').forEach(function (x) { if (!x.closest('.pdp')) x.style.viewTransitionName = ''; }); });
    // Coming back from a product page, its photo shrinks back into the card it came from.
    addEventListener('pagereveal', function (e) {
      if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from || $('.pdp')) return;
      var from = new URL(navigation.activation.from.url), model = from.searchParams.get('model'), color = from.searchParams.get('color');
      if (!/\/product(\.html)?$/.test(from.pathname) || !model) return;
      var card = $$('.card').filter(function (c) { var a = $('a[href*="/product"]', c); return a && a.href.indexOf('model=' + model) > -1 && (!color || a.href.indexOf('color=' + color) > -1); })[0];
      var media = card && $('.card__media .ph', card);
      if (!media) return;
      media.style.viewTransitionName = 'product-hero';
      e.viewTransition.finished.then(function () { media.style.viewTransitionName = ''; });
    });
    // Shop pages are static, so the browser can prerender one as soon as you hover or press on a link to it.
    if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      var rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = JSON.stringify({ prerender: [{ where: { or: [{ href_matches: '/product*' }, { href_matches: '/shop*' }, { href_matches: '/how-it-works*' }, { href_matches: '/careers' }, { href_matches: '/' }] }, eagerness: 'moderate' }] });
      document.head.appendChild(rules);
    }
  }
  function hideOnScroll() {
    var h = $('.site-header'), last = scrollY;
    addEventListener('scroll', function () {
      var y = scrollY, d = y - last;
      if (Math.abs(d) < 6) return;
      h.classList.toggle('is-hidden', d > 0 && y > 160 && !document.querySelector('.search-takeover.is-open, .menu.is-open'));
      last = y;
    }, { passive: true });
  }

  // ---------- chrome ----------
  // On the public site the shop says what it is; run locally from the case folder, it's just the shop.
  var HOSTED = location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var STRIP = ['Free delivery across Europe', 'Free 30-day returns', 'New: the Ultra Comfort Loafer', 'Shipped straight from the makers in Italy'];
  function strip() {
    var p = $('#strip-msg'), i = 0, timer;
    var show = function (d) {
      i = (i + d + STRIP.length) % STRIP.length;
      p.classList.add('is-out');
      setTimeout(function () { p.textContent = STRIP[i]; p.classList.remove('is-out'); }, reduced ? 0 : 180);
    };
    $$('[data-strip]').forEach(function (b) { b.addEventListener('click', function () { show(Number(b.dataset.strip)); clearInterval(timer); }); });
    if (!reduced) {
      timer = setInterval(function () { show(1); }, 5000);
      $('.strip').addEventListener('mouseenter', function () { clearInterval(timer); });
    }
  }
  function chrome() {
    var page = document.body.dataset.page;
    var cur = function (p) { return page === p ? ' aria-current="page"' : ''; };
    var top = $('#chrome-top'), bottom = $('#chrome-bottom');
    top.outerHTML = '<a class="skip" href="#main">Skip to content</a><div class="nav-progress" id="nav-progress"></div>' +
      (HOSTED ? '<div class="case-strip" role="note"><span>A fictional shop, built as a hiring case. <b>Operations is invite-only.</b></span><a href="/careers">We’re hiring →</a></div>' : '') +
      '<div class="strip" role="region" aria-label="Announcements"><button type="button" data-strip="-1" aria-label="Previous message">' + ICON.left + '</button>' +
        '<p id="strip-msg" aria-live="polite">' + STRIP[0] + '</p><button type="button" data-strip="1" aria-label="Next message">' + ICON.right + '</button></div>' +
      '<header class="site-header"><div class="site-header__inner">' +
        '<div class="hdr-left"><button class="icon-btn" type="button" data-open-menu aria-label="Menu" aria-controls="menu" aria-expanded="false">' + ICON.menu + '</button>' +
          '<nav class="hdr-links" aria-label="Main"><a href="' + href('/shop') + '"' + cur('shop') + '>Shop</a><a href="' + href('/shop?collection=ultra') + '">Ultra Comfort</a><a href="' + href('/how-it-works') + '"' + cur('how') + '>How it works</a></nav></div>' +
        '<a class="wordmark" href="' + href('/') + '" aria-label="Ciabatta Club, home">Ciabatta <i>Club</i></a>' +
        '<div class="hdr-right"><button class="icon-btn" type="button" data-open-search aria-label="Search">' + ICON.search + '</button>' +
          '<button class="icon-btn" type="button" data-open-bag aria-label="Open bag">' + ICON.bag + '<span class="bag-count" aria-live="polite"></span></button>' +
          '<a class="ops-btn" href="admin/" aria-label="Operations">' + ICON.key + '<span>Operations</span></a></div>' +
      '</div></header>';
    bottom.outerHTML = footerHTML() +
      '<div class="overlay" id="menu-overlay"></div><aside class="menu" id="menu" aria-label="Menu" aria-hidden="true">' +
        '<div class="drawer__head"><h2>Menu</h2><button class="icon-btn" type="button" data-close-menu aria-label="Close menu">' + ICON.close + '</button></div>' +
        '<nav>' + [['/shop', 'Shop all', 'Every pair'], ['/shop?collection=ultra', 'Ultra Comfort', 'Flip-flops, loafers, socks'], ['/shop?type=Loafer', 'Loafers', 'New this summer'],
          ['/shop?type=Socks', 'Socks', 'The other half of comfort'], ['/shop?collection=marche', 'Handmade in Marche', 'The Ortensi workshop'], ['/how-it-works', 'How it works', 'Delivery, returns, payments']]
          .map(function (l) { return '<a href="' + href(l[0]) + '">' + l[1] + '<small>' + l[2] + '</small></a>'; }).join('') + '</nav>' +
        '<div class="menu__foot"><a class="btn btn--dark btn--block" href="admin/">Operations</a><p class="muted" style="font-size:14px">The back office for the case: orders, returns, agents and Sam’s note.</p></div></aside>' +
      '<div class="search-takeover" id="takeover" role="dialog" aria-modal="true" aria-label="Search"><div class="search-takeover__scrim" data-close-search></div><div class="search-takeover__panel search-panel">' +
        '<div class="row"><label class="sr-only" for="q2">Search the shop</label>' +
        '<input id="q2" type="search" placeholder="Search flip-flops, loafers, socks" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="takeover-results" aria-autocomplete="list">' +
        '<button class="icon-btn" type="button" data-close-search aria-label="Close search">' + ICON.close + '</button></div><div class="results" id="takeover-results" role="listbox" aria-label="Search suggestions"></div></div></div>' +
      '<div class="overlay" id="bag-overlay"></div><aside class="drawer" id="bag" aria-hidden="true" aria-labelledby="bag-title" role="dialog" aria-modal="true">' +
        '<div class="drawer__head"><h2 id="bag-title">Bag</h2><button class="icon-btn" id="bag-close" type="button" aria-label="Close bag">' + ICON.close + '</button></div>' +
        '<div class="drawer__body" id="bag-body"></div><div class="drawer__foot" id="bag-foot">' +
          '<div class="reassure">' + ICON.truck + '<span>Free delivery · Free 30-day returns</span></div>' +
          '<div class="totals"><span>Subtotal</span><span id="bag-total"></span></div><p class="muted" style="font-size:14px">Incl. VAT. Pay by card, PayPal or invoice.</p>' +
          '<button class="btn btn--dark btn--lg btn--block" type="button" id="checkout">Checkout</button><p class="notice" id="bag-notice" hidden>' + CHECKOUT_OFF + '</p></div></aside>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

    $$('.bag-count').forEach(function (b) { b.textContent = bagCount() || ''; });
    strip();
    var take = $('#takeover'), q2 = $('#q2'), res = $('#takeover-results');
    var cb = combobox(q2, res, 'tq-');
    var searchOpener = null;
    var closeSearch = function () { take.classList.remove('is-open'); if (searchOpener) searchOpener.focus(); };
    $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', function () { searchOpener = b; take.classList.add('is-open'); cb.open(); q2.focus(); }); });
    q2.addEventListener('blur', function () { res.classList.add('is-open'); });
    $$('[data-close-search]').forEach(function (b) { b.addEventListener('click', closeSearch); });
    take.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });

    var menu = $('#menu'), menuBtn = $('[data-open-menu]');
    var setMenu = function (open) {
      menu.classList.toggle('is-open', open); $('#menu-overlay').classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open)); menuBtn.setAttribute('aria-expanded', String(open));
      if (open) setTimeout(function () { $('[data-close-menu]').focus(); }, 60); else menuBtn.focus();
    };
    menuBtn.addEventListener('click', function () { setMenu(true); });
    $('[data-close-menu]').addEventListener('click', function () { setMenu(false); });
    $('#menu-overlay').addEventListener('click', function () { setMenu(false); });
    menu.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); trapFocus(menu, e); });

    $$('[data-open-bag]').forEach(function (b) { b.addEventListener('click', openBag); });
    $('#bag-close').addEventListener('click', closeBag);
    $('#bag-overlay').addEventListener('click', closeBag);
    $('#bag').addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBag(); trapFocus($('#bag'), e); });
    $('#bag-body').addEventListener('click', function (e) {
      var q = e.target.closest('[data-qty]'), rm = e.target.closest('[data-remove]');
      if (q) { var i = bag[q.dataset.i]; i.qty += Number(q.dataset.qty); if (i.qty < 1) bag.splice(q.dataset.i, 1); saveBag(); renderBag(); }
      if (rm) { bag.splice(rm.dataset.remove, 1); saveBag(); renderBag(); }
      var sock = e.target.closest('[data-sock]');
      if (sock) { addToBag('SOX', 'OAT', Number(sock.dataset.sock)); toast('Socks added'); }
    });
    $('#checkout').addEventListener('click', function () { $('#bag-notice').hidden = false; });
    $$('.newsletter').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); toast('Thanks. This is a case, so no emails will be sent.'); f.reset(); }); });
    bindNav();
    hideOnScroll();
  }
  function footerHTML() {
    var link = function (u, t) { return '<li><a href="' + href(u) + '">' + t + '</a></li>'; };
    return '<footer class="site-footer"><div class="container"><div class="footer-grid">' +
      '<div><a class="wordmark" href="' + href('/') + '">Ciabatta <i>Club</i></a><p style="margin-top:14px;max-width:36ch;color:#c9c2b9">Ciabatta Ultra Comfort, and leather pairs handmade in Marche. Shipped straight from the makers in Italy.</p>' +
        '<form class="newsletter" aria-label="Newsletter"><label class="sr-only" for="nl">Email</label><input id="nl" type="email" required placeholder="you@example.com"><button class="btn" type="submit">Sign up</button></form></div>' +
      '<div><h2>Shop</h2><ul>' + MODELS.map(function (m) { return link('/product?model=' + m.code + '&color=' + m.colors[0].code, esc(m.name)); }).join('') + '</ul></div>' +
      '<div><h2>Help</h2><ul>' + link('/how-it-works', 'How it works') + link('/how-it-works#returns', 'Delivery and returns') + link('/#size-finder', 'Size finder') + '<li><a href="mailto:hello@ciabattaclub.example">hello@ciabattaclub.example</a></li></ul></div>' +
      '<div><h2>Company</h2><ul>' + link('/how-it-works#workshop', 'The makers') + link('/how-it-works#second-life', 'Returned pairs') + '<li><a href="admin/">Operations</a></li>' + (HOSTED ? link('/careers', 'Careers') : '') + '</ul></div>' +
      '</div><div class="footer-base"><span>Ciabatta Club is a fictional shop made for a hiring case. Ciabatta, Ortensi, Kade Returns and every customer are invented.</span>' +
      '<span class="paymarks" aria-label="Payment options"><span>Card</span><span>PayPal</span><span>Pay later</span></span></div></div></footer>';
  }

  function hydratePh(root) {
    $$('[data-ph]', root).forEach(function (el) {
      el.outerHTML = ph({ id: el.dataset.id, swatch: el.dataset.swatch, mix: Number(el.dataset.mix || 0.4), caption: el.dataset.caption, chip: false, cls: el.dataset.cls });
    });
  }
  function boot(render) {
    chrome();
    hydratePh(document);
    if (render) render();
    initRails(document);
    bindCards(document.body);
    reveal(document);
    document.body.classList.add('is-ready');
  }

  window.CC = {
    CAT: CAT, MODELS: MODELS, PHOTOS: PHOTOS, hasShot: hasShot, FEATURED: FEATURED, ICON: ICON, CHECKOUT_OFF: CHECKOUT_OFF, VIEW_KEY: VIEW_KEY,
    $: $, $$: $$, esc: esc, eur: eur, store: store, reduced: reduced, model: model, colorOf: colorOf, variants: variants,
    stock: stock, stockLine: stockLine, pdpHref: pdpHref, href: href, ph: ph, mix: mix, productShot: productShot, shotId: shotId,
    ULTRA: ULTRA, collection: collection, isSocks: isSocks, sizeLabel: sizeLabel, sizeText: sizeText, socksUpsell: socksUpsell,
    LIFE: LIFE, GALLERY: GALLERY, lifeImg: lifeImg,
    card: card, rail: rail, initRails: initRails, reveal: reveal, addToBag: addToBag, openBag: openBag, toast: toast, go: go, boot: boot,
  };
})();
