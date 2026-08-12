/* Pointer-follow tilt for liquid-glass pages (html.theme-glass). */
(function () {
  'use strict';

  var MAX_TILT = 18;
  var SHIFT = 10;
  var LIFT = 8;
  var SCALE = 1.06;
  var SELECTOR = '.btn, .btn-primary, .btn-ghost, .auth-tab-btn, a.site-link';
  var bound = new WeakSet();

  function glassOn() {
    return document.documentElement.classList.contains('theme-glass');
  }

  function motionOk() {
    if (document.documentElement.classList.contains('theme-no-motion')) return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) {}
    return true;
  }

  function clear(el) {
    el.classList.remove('lg-tilting');
    el.style.removeProperty('transform');
    el.style.removeProperty('transition');
    el.style.removeProperty('z-index');
  }

  function setTransform(el, value) {
    el.style.setProperty('transform', value, 'important');
  }

  function bindOne(el) {
    if (!el || bound.has(el)) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    bound.add(el);

    el.addEventListener('pointerenter', function () {
      if (!glassOn() || !motionOk()) return;
      el.classList.add('lg-tilting');
      el.style.transition = 'transform 50ms linear';
      el.style.zIndex = '3';
    });

    el.addEventListener('pointermove', function (e) {
      if (!glassOn() || !motionOk()) {
        clear(el);
        return;
      }
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      var nx = (px - 0.5) * 2;
      var ny = (py - 0.5) * 2;
      var ry = nx * MAX_TILT;
      var rx = -ny * MAX_TILT;
      var tx = nx * SHIFT;
      var ty = ny * SHIFT * 0.65 - LIFT;
      el.classList.add('lg-tilting');
      setTransform(
        el,
        'perspective(380px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) ' +
          'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + SCALE + ')'
      );
    });

    el.addEventListener('pointerleave', function () {
      el.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
      setTransform(el, 'perspective(380px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0) scale(1)');
      window.setTimeout(function () {
        if (!el.matches(':hover')) clear(el);
      }, 360);
    });

    el.addEventListener('pointercancel', function () { clear(el); });
    el.addEventListener('blur', function () { clear(el); });
  }

  function bindAll(root) {
    var nodes = (root || document).querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) bindOne(nodes[i]);
  }

  function boot() {
    bindAll(document);
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(SELECTOR)) bindOne(n);
          if (n.querySelectorAll) bindAll(n);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
