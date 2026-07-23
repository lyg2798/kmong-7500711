/*
 * Swaps the Invitation section's placeholder copy for the couple's greeting.
 *
 * Why this isn't just an edit to the page's JSON: the greeting is 13 lines
 * where the placeholder is 3, and Canva does not lay the section out again
 * cleanly when a paragraph grows. Editing the stored text was measured at
 * 390px wide -- the four elements underneath ended up at gaps of -61/55/32/50
 * where the design has 28/20/32/50, i.e. the parents' names overlapped the
 * greeting and the spacing below it went uneven. Setting the stored height
 * alongside the text changed nothing: sibling placement is not derived from
 * it. So the stored text stays as-is, Canva lays the section out exactly as
 * it does today, and the swap happens here -- after which every element
 * below is pushed down by however far the new text overruns the old box,
 * which preserves the original gaps without hardcoding any of them.
 *
 * Canva rewrites these inline styles wholesale on viewport resize (same
 * behaviour gallery.js and align.js contend with), so everything is
 * re-applied continuously and every measurement is taken live.
 */
(function () {
  'use strict';

  var PLACEHOLDER_PREFIX = 'We’re getting married';

  var GREETING = [
    '당신은 왜 그렇게 사람들이 결혼을 한다고 생각해요 ?',
    '우리 삶에는 증인이 필요하기 때문이에요',
    '좋은 일들 나쁜 일들 지루하고 사소한 일들까지도 그 모든 것들을요 언제나 매일같이',
    '그래서 결혼을 하는 이유를 이렇게 말할 수 있어요',
    '당신의 삶이 아무 의미 없이 헛되이 흘러가게 두지 않을 거에요',
    '내가 온 마음을 다해 당신을 알아봐줄테니까요',
    '당신의 삶이 홀로 외로이 흐르지 않게 할게요',
    '내가 당신의 곁에서 모든 순간의 증인이 되어줄테니까요',
    '-영화 <쉘 위 댄스 Shall We Dance?>-',
    '',
    '예쁘게 잘 살겠습니다.',
    '귀한 발걸음 하시어',
    '축복해주시면 감사하겠습니다.'
  ];

  var DONE = 'data-inv-swapped';
  var SHIFT = 'data-inv-shift';

  function findCanvases() {
    return document.querySelectorAll('._mXnjA');
  }

  function findPlaceholder(canvas) {
    for (var i = 0; i < canvas.children.length; i++) {
      var child = canvas.children[i];
      if ((child.textContent || '').indexOf(PLACEHOLDER_PREFIX) === 0) return child;
    }
    return null;
  }

  // Canva renders each paragraph as its own <p>; replacing their contents
  // keeps the font, colour and centring the design already applies rather
  // than restating them here.
  function swapText(rowGroup) {
    var ps = rowGroup.getElementsByTagName('p');
    if (!ps.length) return false;
    var template = ps[0];
    var parent = template.parentNode;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < GREETING.length; i++) {
      var p = template.cloneNode(false);
      // a blank line still needs to occupy its line box
      p.textContent = GREETING[i] === '' ? ' ' : GREETING[i];
      frag.appendChild(p);
    }
    while (parent.firstChild) parent.removeChild(parent.firstChild);
    parent.appendChild(frag);
    rowGroup.setAttribute(DONE, '1');
    return true;
  }

  function inkBottom(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var max = -Infinity;
    var range = document.createRange();
    var node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        if (!rects[i].width && !rects[i].height) continue;
        if (rects[i].bottom > max) max = rects[i].bottom;
      }
    }
    return max === -Infinity ? null : max;
  }

  function parseTranslate(transform) {
    var m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(transform || '');
    return m ? { x: m[1], y: parseFloat(m[2]) } : null;
  }

  // Compare the number we wrote, not the string we wrote: the browser
  // re-serialises `transform`/`height`, so a string comparison reports "not
  // mine" on a value this just set and the offset stacks on every observer
  // pass -- at 768px wide that ran away to a ~1,000,000px displacement
  // before the numeric check replaced it.
  var EPSILON = 0.05;

  function alreadyAt(el, value) {
    var applied = parseFloat(el.getAttribute(SHIFT));
    return !isNaN(applied) && Math.abs(applied - value) < EPSILON;
  }

  function shiftBy(el, delta) {
    var t = parseTranslate(el.style.transform);
    if (!t) return;
    if (alreadyAt(el, t.y)) return;   // t.y is our own output from last pass
    var next = t.y + delta;
    el.style.transform = el.style.transform.replace(
      /translate\(\s*-?[\d.]+px\s*,\s*-?[\d.]+px\s*\)/,
      'translate(' + t.x + 'px, ' + next.toFixed(3) + 'px)'
    );
    el.setAttribute(SHIFT, next.toFixed(3));
  }

  function growSection(canvas, section, delta) {
    var el = canvas;
    while (el && el !== section.parentElement) {
      if (el.style && el.style.height) {
        var current = parseFloat(el.style.height);
        if (!alreadyAt(el, current)) {
          var next = current + delta;
          el.style.height = next.toFixed(2) + 'px';
          el.setAttribute(SHIFT, next.toFixed(3));
        }
      }
      el = el.parentElement;
    }
  }

  function process(canvas) {
    var rowGroup = canvas.getAttribute(DONE)
      ? null
      : findPlaceholder(canvas);
    var swapped = canvas.querySelector('[' + DONE + ']');
    if (!rowGroup && !swapped) return;
    if (rowGroup && !swapText(rowGroup)) return;
    var target = rowGroup || swapped;

    var box = target.getBoundingClientRect();
    var bottom = inkBottom(target);
    if (bottom === null) return;
    var delta = bottom - box.bottom;
    if (delta <= 0) return;

    var section = canvas.closest ? canvas.closest('section') : null;
    if (!section) return;

    for (var i = 0; i < canvas.children.length; i++) {
      var el = canvas.children[i];
      if (el === target) continue;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.top <= box.top) continue;
      shiftBy(el, delta);
    }
    growSection(canvas, section, delta);
  }

  function scan() {
    var canvases = findCanvases();
    for (var i = 0; i < canvases.length; i++) process(canvases[i]);
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
})();
