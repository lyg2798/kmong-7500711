/*
 * Corrects horizontal centering on a handful of main-page text blocks that
 * are off-center in the original Canva design itself (confirmed live on the
 * source Canva site with the same offsets -- not something this mirror
 * introduced; the client asked for it to be fixed here anyway). Off-screen
 * duplicates of unrelated text that Canva parks around x=662 on a 390-wide
 * canvas are its responsive alternate-layout copies and are never touched
 * (they don't match any of the prefixes below).
 *
 * Two independent problems, fixed in order:
 *   1. Multi-line blocks are left-aligned within a shared box, so shorter
 *      lines read as visibly off-center even once the box itself is
 *      centered. Fixed with an explicit text-align per <p> line (see
 *      align.css) -- applied first, since it changes where the ink sits.
 *   2. The row-group's own translateX doesn't put that ink at the section
 *      canvas's center. The row-group's *own* bounding box is not a
 *      reliable stand-in for where the glyphs actually render (one target
 *      has a 621px-wide box for a two-word title) so the correction is
 *      computed from the ink itself: a Range over every text node inside
 *      the row-group, unioned into one bounding box. translateY is never
 *      touched.
 *
 * Like gallery.js, Canva rewrites these row-groups' style attributes
 * wholesale on viewport resize, so both fixes are re-applied continuously
 * via MutationObserver rather than once. All coordinates are measured live,
 * every call -- nothing here is hardcoded.
 */
(function () {
  'use strict';

  // '참석이 어려우신...' is deliberately absent: it shares a row with the
  // photo on the right, so centering it on the canvas slides it under the
  // photo. It is already centered within its own column.
  //
  // `align` is how the lines sit relative to each other; the row-group as a
  // whole is centered on the canvas either way. So the transit/parking block
  // reads as a flush-left list whose longest line stays where a centered
  // block would put it -- rather than starting at the left edge of the
  // 707px-wide box Canva gives it, which begins off-screen.
  //
  // The two parents'-names lines under the greeting are one row-group each,
  // already centered inside their own box, so `align` is a no-op for them --
  // what is off is the boxes: measured at 390 wide, '이해운...' sits exactly on
  // the canvas center while '김광명...' sits 3.0px left of it, even though the
  // two lines have identical 167.7px ink. The live Canva site is off by the
  // same amount at every width measured (-3.0 at 390, -2.9 at 430, -2.2 at
  // 768), so it is a stray drag in the source design rather than anything
  // this mirror did -- fixed here alongside the other blocks the client asked
  // about, and unlike the off-screen responsive duplicates noted at the top
  // of this file it is on-screen and plainly visible. They are also two of
  // the siblings invitation.js pushes down after it swaps in the 13-line
  // greeting, which is safe because the two corrections are on different axes
  // and neither reads the other's: invitation.js rewrites translateY and
  // carries translateX through verbatim, and the correction below rewrites
  // translateX from a live ink measurement that converges to a zero delta, so
  // whichever runs first on a given pass the other still settles.
  var TARGETS = [
    { prefix: '마음 전하실 곳', align: 'center' },
    { prefix: '코스요리가', align: 'center' },
    { prefix: '지하철', align: 'left' },
    { prefix: '이해운', align: 'center' },
    { prefix: '김광명', align: 'center' }
  ];
  // below this, the ink is already close enough to center that re-writing
  // the transform would just be floating-point noise -- treat as settled.
  var MIN_DELTA = 0.5;

  function findTargetRowGroups() {
    var found = [];
    var canvases = document.querySelectorAll('._mXnjA');
    Array.prototype.forEach.call(canvases, function (canvas) {
      Array.prototype.forEach.call(canvas.children, function (child) {
        if (child.classList && child.classList.contains('cg-root')) return;
        var text = (child.innerText || child.textContent || '').trim();
        for (var i = 0; i < TARGETS.length; i++) {
          if (text.indexOf(TARGETS[i].prefix) === 0) {
            found.push({ el: child, canvas: canvas, align: TARGETS[i].align });
            break;
          }
        }
      });
    });
    return found;
  }

  function parseTranslate(transformStr) {
    var m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(transformStr || '');
    if (!m) return null;
    return { tx: parseFloat(m[1]), ty: parseFloat(m[2]) };
  }

  // union of Range.getClientRects() over every non-empty text node in the
  // subtree -- this is the actual glyph extent, unlike an element's own
  // getBoundingClientRect() which reflects its line-box/declared width.
  function measureInkCenterX(rowGroup) {
    var walker = document.createTreeWalker(rowGroup, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var minX = Infinity;
    var maxX = -Infinity;
    var found = false;
    var range = document.createRange();
    var node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (r.width === 0 && r.height === 0) continue;
        found = true;
        if (r.left < minX) minX = r.left;
        if (r.right > maxX) maxX = r.right;
      }
    }
    if (!found) return null;
    return (minX + maxX) / 2;
  }

  function ensureLineAligned(rowGroup, align) {
    var ps = rowGroup.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].getAttribute('data-cg-align-line') !== align) {
        ps[i].setAttribute('data-cg-align-line', align);
      }
    }
    return ps.length > 0;
  }

  // cheap check (no layout forced) so the MutationObserver callback can
  // skip straight past targets that are already correctly positioned,
  // instead of re-measuring ink (which forces layout) on every unrelated
  // mutation elsewhere on the page.
  function isSettled(rowGroup, align) {
    var ps = rowGroup.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].getAttribute('data-cg-align-line') !== align) return false;
    }
    var marker = rowGroup.getAttribute('data-cg-align-tx');
    return marker !== null && rowGroup.style.transform === marker;
  }

  function processTarget(entry) {
    var rowGroup = entry.el;
    if (isSettled(rowGroup, entry.align)) return;

    var hadLines = ensureLineAligned(rowGroup, entry.align);
    if (!hadLines) return;

    var inkCx = measureInkCenterX(rowGroup);
    if (inkCx === null) return;

    // ink comes from getClientRects(), which is viewport-relative, so the
    // canvas center has to be too -- it happens to sit flush at x=0 today,
    // but reading width/2 alone would silently skew if that ever changed.
    var canvasRect = entry.canvas.getBoundingClientRect();
    var canvasCx = canvasRect.left + canvasRect.width / 2;
    var delta = canvasCx - inkCx;

    var parsed = parseTranslate(rowGroup.style.transform);
    if (!parsed) return;

    var newTransform;
    if (Math.abs(delta) < MIN_DELTA) {
      newTransform = rowGroup.style.transform;
    } else {
      var newTx = parsed.tx + delta;
      newTransform = rowGroup.style.transform.replace(
        /translate\(\s*-?[\d.]+px\s*,\s*-?[\d.]+px\s*\)/,
        'translate(' + newTx.toFixed(3) + 'px, ' + parsed.ty + 'px)'
      );
      if (rowGroup.style.transform !== newTransform) {
        rowGroup.style.transform = newTransform;
      }
    }
    rowGroup.setAttribute('data-cg-align-tx', newTransform);
  }

  function scan() {
    var targets = findTargetRowGroups();
    targets.forEach(processTarget);
  }

  scan();
  var observer = new MutationObserver(function () { scan(); });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
})();
