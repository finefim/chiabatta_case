/* Ciabatta Club storefront · Tweaks. Loaded in <head> so the chosen theme paints first.
   The panel shows only with ?tweaks=1 (kept on internal links) or after pressing T. */
(function () {
  'use strict';
  var KEY = 'cc_tweaks_v3';
  var OPTIONS = {
    theme: [['', 'Studio (warm off-white)'], ['riviera', 'Riviera'], ['clean', 'Clean white'], ['night', 'Night']],
    font: [['', 'Iowan Old Style'], ['charter', 'Charter'], ['didot', 'Didot'], ['sans', 'Avenir Next (sans)']],
    hero: [['', 'Flip-flops on the coast'], ['loafer', 'Loafers in the lane']],
    strip: [['on', 'Announcement strip on'], ['off', 'Announcement strip off']],
  };
  var LABELS = { theme: 'Theme', font: 'Display font', hero: 'Home hero photo', strip: 'Announcement bar' };
  var state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  var root = document.documentElement;
  function apply() {
    Object.keys(OPTIONS).forEach(function (k) {
      var v = state[k] || '';
      if (v && v !== 'on') root.setAttribute('data-' + k, v); else root.removeAttribute('data-' + k);
    });
  }
  apply();

  function panel() {
    if (document.getElementById('tweaks')) return document.getElementById('tweaks');
    var el = document.createElement('section');
    el.id = 'tweaks'; el.className = 'tweaks'; el.setAttribute('aria-label', 'Tweaks');
    el.innerHTML = '<h2>Tweaks <button type="button" aria-label="Close Tweaks" data-close>×</button></h2>' + Object.keys(OPTIONS).map(function (k) {
      return '<label>' + LABELS[k] + '<select data-k="' + k + '">' + OPTIONS[k].map(function (o) {
        return '<option value="' + o[0] + '"' + ((state[k] || OPTIONS[k][0][0]) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>';
    }).join('');
    el.addEventListener('change', function (e) {
      var k = e.target.dataset.k; if (!k) return;
      state[k] = e.target.value;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
      var done = function () { apply(); document.dispatchEvent(new CustomEvent('tweaks:change')); };
      if (document.startViewTransition) document.startViewTransition(done); else done();
    });
    el.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) el.classList.remove('is-open'); });
    document.body.appendChild(el);
    return el;
  }
  function toggle(force) { var p = panel(); p.classList.toggle('is-open', force == null ? !p.classList.contains('is-open') : force); }
  document.addEventListener('DOMContentLoaded', function () { if (/[?&]tweaks=1/.test(location.search)) toggle(true); });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(e.target.tagName)) toggle();
  });
})();
