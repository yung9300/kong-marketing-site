/* Kong glossary: search, filters, A to Z, copy link, back to top, GA4. Everything here only hides
   or annotates content that is already in the HTML. With JS off the page is a complete dictionary. */
(function () {
  'use strict';
  var UI = window.GL_UI || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bar = $('#gl-bar'), sentinel = $('#gl-sentinel'), spacer = $('#gl-spacer');
  var q = $('#gl-q'), clearBtn = $('#gl-clear'), filtersBtn = $('#gl-filters');
  var count = $('#gl-count'), empty = $('#gl-empty'), toast = $('#gl-toast'), topBtn = $('#gl-top');
  var entries = $$('.gl-entry'), sections = $$('.gl-letter-section'), chips = $$('.gl-chip'), letters = $$('.gl-letter');
  var cat = 'all', query = '';
  var norm = function (s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  var ga = function (name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); };

  // Build the index from the page itself: term/alt names (data-search) and definition text.
  entries.forEach(function (el) {
    var def = $('.gl-def', el);
    el._t = el.getAttribute('data-search') || '';
    el._d = norm(def ? def.textContent : '');
  });

  function setBarHeight() {
    if (!bar) return;
    var h = bar.offsetHeight;
    if (h > 0) document.documentElement.style.setProperty('--gl-bar-h', h + 'px');
  }

  function apply(fromUser) {
    var nq = norm(query), shown = 0, termHits = [];
    entries.forEach(function (el) {
      var okCat = cat === 'all' || el.getAttribute('data-cat') === cat;
      var okQ = !nq || el._t.indexOf(nq) > -1 || el._d.indexOf(nq) > -1;
      var show = okCat && okQ;
      el.hidden = !show;
      if (show) { shown++; if (nq && el._t.indexOf(nq) > -1) termHits.push(el); }
    });
    // Term-name matches sort above definition-only matches within each letter section.
    sections.forEach(function (sec) {
      var vis = $$('.gl-entry', sec).filter(function (e) { return !e.hidden; });
      sec.hidden = vis.length === 0;
      if (nq && vis.length > 1) {
        vis.sort(function (a, b) { var ta = a._t.indexOf(nq) > -1 ? 0 : 1, tb = b._t.indexOf(nq) > -1 ? 0 : 1; return ta - tb; })
          .forEach(function (e) { sec.appendChild(e); });
      } else if (!nq) {
        $$('.gl-entry', sec).sort(function (a, b) { return a._i - b._i; }).forEach(function (e) { sec.appendChild(e); });
      }
    });
    letters.forEach(function (l) {
      var L = l.getAttribute('data-letter');
      if (!L) return;
      var sec = sections.filter(function (s) { return s.getAttribute('data-letter') === L; })[0];
      var dis = !sec || sec.hidden;
      l.classList.toggle('is-disabled', dis);
      if (dis) { l.setAttribute('aria-disabled', 'true'); l.setAttribute('tabindex', '-1'); }
      else { l.removeAttribute('aria-disabled'); l.removeAttribute('tabindex'); }
    });
    var msg = (!nq && cat === 'all') ? UI.countAll.replace('{n}', UI.n) : shown === 1 ? UI.count1 : UI.countN.replace('{n}', shown);
    if (count) count.textContent = msg;
    if (empty) {
      empty.hidden = shown !== 0;
      if (shown === 0) {
        var p = $('p', empty);
        var text = UI.empty.replace('{q}', query);
        var parts = text.split(/WhatsApp/);
        p.textContent = '';
        p.appendChild(document.createTextNode(parts[0]));
        var a = document.createElement('a'); a.href = 'https://wa.me/60124298159'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'WhatsApp';
        p.appendChild(a); p.appendChild(document.createTextNode(parts.slice(1).join('WhatsApp')));
      }
    }
    if (clearBtn) clearBtn.hidden = !query;
    // Search state in the URL; canonical stays clean so these never index as duplicates.
    var sp = new URLSearchParams();
    if (query) sp.set('q', query);
    if (cat !== 'all') sp.set('cat', cat);
    var url = location.pathname + (sp.toString() ? '?' + sp.toString() : '') + location.hash;
    if (fromUser) history.replaceState(null, '', url);
    if (fromUser && nq && shown === 0) ga('glossary_no_results', { search_term: query });
    updateCurrentLetter();
  }
  entries.forEach(function (e, i) { e._i = i; });

  var t;
  function onInput() {
    query = q.value;
    apply(true);
    clearTimeout(t);
    t = setTimeout(function () { if (norm(query)) ga('glossary_search', { search_term: query }); }, 900);
  }
  if (q) {
    q.addEventListener('input', onInput);
    q.addEventListener('blur', function () { clearTimeout(t); if (norm(query)) ga('glossary_search', { search_term: query }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
  }
  if (clearBtn) clearBtn.addEventListener('click', function () { q.value = ''; query = ''; apply(true); q.focus(); });
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      c.setAttribute('aria-pressed', 'true');
      cat = c.getAttribute('data-cat');
      apply(true);
      ga('glossary_filter', { category: cat });
    });
  });

  // Copy link
  $$('.gl-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-id');
      var url = location.origin + location.pathname + '#' + id;
      var done = function () { showToast(UI.copied); ga('glossary_copy_link', { term_id: id }); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallback(url); done(); });
      else { fallback(url); done(); }
    });
  });
  function fallback(text) { var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); }
  var toastT;
  function showToast(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, 2000); }

  // In Kong + CTA clicks (app.bookwithkong.com counts as internal to Enhanced Measurement, so send by code)
  $$('[data-gl-kong]').forEach(function (a) { a.addEventListener('click', function () { ga('glossary_in_kong_click', { term_id: a.getAttribute('data-gl-kong'), destination: a.href }); }); });
  $$('[data-gl-cta]').forEach(function (a) { a.addEventListener('click', function () { ga('cta_click', { cta: a.getAttribute('data-gl-cta'), destination: a.href, page: 'glossary' }); }); });

  // Anchor highlight
  function highlight() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var target = document.getElementById(id);
    var el = target && (target.classList.contains('gl-entry') ? target : target.closest('.gl-entry'));
    if (!el) return;
    if (el.hidden) { q.value = ''; query = ''; cat = 'all'; chips.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-cat') === 'all' ? 'true' : 'false'); }); apply(false); }
    el.classList.remove('is-fading'); el.classList.add('is-highlight');
    setTimeout(function () {
      if (reduce) { el.classList.remove('is-highlight'); return; }
      el.classList.add('is-fading'); el.classList.remove('is-highlight');
      setTimeout(function () { el.classList.remove('is-fading'); }, 2100);
    }, reduce ? 1500 : 400);
  }
  window.addEventListener('hashchange', highlight);

  // Current letter while reading
  var ticking = false;
  function updateCurrentLetter() {
    var top = (bar ? bar.offsetHeight : 0) + 16, cur = null;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i]; if (s.hidden) continue;
      if (s.getBoundingClientRect().top <= top) cur = s.getAttribute('data-letter'); else break;
    }
    letters.forEach(function (l) { l.classList.toggle('is-current', !!cur && l.getAttribute('data-letter') === cur); });
  }
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      // Stuck state from geometry as well as the observer, so it never depends on one signal.
      if (sentinel) { var stuck = sentinel.getBoundingClientRect().top < 0; if (stuck !== lastStuck) onStuck(stuck); }
      setBarHeight();
      updateCurrentLetter();
      if (topBtn) topBtn.hidden = window.scrollY < window.innerHeight * 2;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); q && q.focus({ preventScroll: true }); });

  // Sticky bar state. On phones the bar shrinks to search + Filters once stuck; the spacer keeps
  // the document height stable so nothing below jumps.
  var phone = window.matchMedia('(max-width: 760px)');
  var fullH = 0, lastStuck = null;
  function measureFull() { if (!bar) return; var wasCompact = bar.classList.contains('is-compact'); bar.classList.remove('is-compact'); fullH = bar.offsetHeight; if (wasCompact) bar.classList.add('is-compact'); setBarHeight(); }
  function onStuck(stuck) {
    if (!bar) return;
    lastStuck = stuck;
    bar.classList.toggle('is-stuck', stuck);
    if (phone.matches) {
      if (stuck && !bar.classList.contains('is-compact')) {
        bar.classList.add('is-compact');
        spacer.style.height = Math.max(0, fullH - bar.offsetHeight) + 'px';
      } else if (!stuck) {
        bar.classList.remove('is-compact', 'is-open');
        if (filtersBtn) filtersBtn.setAttribute('aria-expanded', 'false');
        spacer.style.height = '0px';
      }
    } else { spacer.style.height = '0px'; }
    setBarHeight();
  }
  if ('IntersectionObserver' in window && sentinel) {
    new IntersectionObserver(function (en) { onStuck(!en[0].isIntersecting); }, { threshold: 0, rootMargin: '-1px 0px 0px 0px' }).observe(sentinel);
  }
  if (filtersBtn) filtersBtn.addEventListener('click', function () {
    var open = bar.classList.toggle('is-open');
    filtersBtn.setAttribute('aria-expanded', String(open));
    setBarHeight();
  });
  window.addEventListener('resize', function () { var wasCompact = bar && bar.classList.contains('is-compact'); measureFull(); if (wasCompact && phone.matches) { bar.classList.add('is-compact'); spacer.style.height = Math.max(0, fullH - bar.offsetHeight) + 'px'; } setBarHeight(); });

  // Boot: read ?q= and ?cat= from the URL, then highlight any anchor.
  measureFull();
  window.addEventListener('load', measureFull);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureFull);
  var params = new URLSearchParams(location.search);
  var q0 = params.get('q') || '', c0 = params.get('cat') || 'all';
  if (q && q0) { q.value = q0; query = q0; }
  if (chips.some(function (c) { return c.getAttribute('data-cat') === c0; })) {
    cat = c0; chips.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-cat') === c0 ? 'true' : 'false'); });
  }
  apply(false);
  if (location.hash) setTimeout(function () { var el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) { el.scrollIntoView === undefined ? 0 : window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 12, behavior: 'auto' }); } highlight(); }, 60);
  onScroll();
})();
