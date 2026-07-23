/*
 * Brings the Invitation section's heading up to the size the other section
 * headings render at, and puts it back on the section's centre line.
 *
 * All six headings (INVITATION / WEDDING DAY / LOCATION / GALLERY /
 * INFORMATION / 마음 전하실 곳) are copies of one design element -- confirmed
 * live: every one of them is a 717.539 x 33.4 text box at font-size 28px, and
 * Canva sizes them by scaling that box down into whatever frame the design
 * gives it. Five of the six sit in a 611.6px frame and so render at scale
 * 0.85237; INVITATION was left in a 280.5px frame, i.e. scale 0.390875 --
 * about 46% of its siblings. Nothing about the text differs, only its frame.
 *
 * So this doesn't restate a font size. It reads the scale the sibling copies
 * are using and gives this heading the frame that scale implies, which keeps
 * the two in step if the design's heading size is ever changed upstream.
 * Two follow-on corrections:
 *   1. The scale transform grows downward from the frame's top-left origin,
 *      which would eat the 20px the design leaves between a heading and the
 *      divider under it. translateY is pulled back by exactly the height
 *      gained, so the heading grows upward into empty space instead and that
 *      gap survives untouched.
 *   2. The original frame left the word ~12px left of the divider's centre
 *      (the "left weighted" look). translateX is recomputed from the rendered
 *      ink -- same approach as align.js, and for the same reason: a frame's
 *      own box is not a reliable stand-in for where the glyphs sit.
 *
 * Canva rewrites these inline styles wholesale on viewport resize (the same
 * behaviour gallery.js, align.js and invitation.js contend with), so both
 * corrections are re-applied continuously via MutationObserver and every
 * measurement is taken live -- nothing here is hardcoded.
 */
(function () {
  'use strict';

  // the heading's glyphs are small-caps in the design's font, so the stored
  // text is lowercase; matching it exactly rather than by prefix keeps
  // "Return to the Invitation" in the footer out of this.
  var HEADING_TEXT = 'invitation';

  var SCALE_RE = /scale\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/;
  var TRANSLATE_RE = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/;
  // declared sizes closer than this are the same box re-measured
  var SAME_BOX = 0.5;
  // below this the ink is already centred closely enough that re-writing the
  // transform would just be floating-point noise
  var MIN_DELTA = 0.5;
  var CENTRED = 'data-cg-heading-tx';

  function findHeading() {
    var canvases = document.getElementsByClassName('_mXnjA');
    for (var i = 0; i < canvases.length; i++) {
      var kids = canvases[i].children;
      for (var j = 0; j < kids.length; j++) {
        if ((kids[j].textContent || '').trim() === HEADING_TEXT) {
          return { rowGroup: kids[j], canvas: canvases[i] };
        }
      }
    }
    return null;
  }

  // the scale every other copy of this design text box renders at. Matched on
  // the box's declared dimensions rather than on sibling copy text, so
  // rewording any heading doesn't cost us the reference.
  function referenceScale(inner) {
    var w = parseFloat(inner.style.width);
    var h = parseFloat(inner.style.height);
    if (isNaN(w) || isNaN(h)) return 0;
    var best = 0;
    var boxes = document.getElementsByClassName('aF9o6Q');
    for (var i = 0; i < boxes.length; i++) {
      var el = boxes[i];
      if (el === inner) continue;
      if (Math.abs(parseFloat(el.style.width) - w) > SAME_BOX) continue;
      if (Math.abs(parseFloat(el.style.height) - h) > SAME_BOX) continue;
      var m = SCALE_RE.exec(el.style.transform || '');
      if (m) best = Math.max(best, parseFloat(m[1]));
    }
    return best;
  }

  // union of Range.getClientRects() over every non-empty text node in the
  // subtree -- the actual glyph extent, unlike an element's own
  // getBoundingClientRect() which reflects its declared frame.
  function measureInkCenterX(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var minX = Infinity;
    var maxX = -Infinity;
    var range = document.createRange();
    var node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        if (!rects[i].width && !rects[i].height) continue;
        if (rects[i].left < minX) minX = rects[i].left;
        if (rects[i].right > maxX) maxX = rects[i].right;
      }
    }
    return minX === Infinity ? null : (minX + maxX) / 2;
  }

  function setTranslate(el, x, y) {
    el.style.transform = el.style.transform.replace(
      TRANSLATE_RE, 'translate(' + x + 'px, ' + y + 'px)'
    );
  }

  // Returns true once the heading is at the reference size. The guard is the
  // frame's height rather than the scale itself, because the height is what
  // the upward shift below is computed against -- so the two can never be
  // applied a different number of times.
  function resize(rowGroup) {
    var inner = rowGroup.getElementsByClassName('aF9o6Q')[0];
    if (!inner) return false;
    var scaleMatch = SCALE_RE.exec(inner.style.transform || '');
    var translateMatch = TRANSLATE_RE.exec(rowGroup.style.transform || '');
    if (!scaleMatch || !translateMatch) return false;

    // no sibling heading has rendered yet -- sections mount as the visitor
    // scrolls, though the reference is in fact already on screen: WEDDING DAY
    // shares the Invitation section.
    var target = referenceScale(inner);
    if (!target) return false;
    if (parseFloat(scaleMatch[1]) >= target) return true;

    var oldH = parseFloat(rowGroup.style.height);
    var newW = parseFloat(inner.style.width) * target;
    var newH = parseFloat(inner.style.height) * target;
    if (isNaN(oldH) || isNaN(newW) || isNaN(newH)) return false;

    inner.style.transform = inner.style.transform.replace(
      SCALE_RE, 'scale(' + target + ', ' + target + ')'
    );
    rowGroup.style.width = newW.toFixed(3) + 'px';
    rowGroup.style.height = newH.toFixed(3) + 'px';
    // grow upward, not downward, so the gap to the divider below is untouched
    setTranslate(
      rowGroup,
      translateMatch[1],
      (parseFloat(translateMatch[2]) - (newH - oldH)).toFixed(3)
    );
    return true;
  }

  function centre(rowGroup, canvas) {
    if (rowGroup.getAttribute(CENTRED) === rowGroup.style.transform) return;

    var inkCx = measureInkCenterX(rowGroup);
    if (inkCx === null) return;
    // ink comes from getClientRects(), which is viewport-relative, so the
    // canvas centre has to be too.
    var canvasRect = canvas.getBoundingClientRect();
    var delta = (canvasRect.left + canvasRect.width / 2) - inkCx;

    if (Math.abs(delta) >= MIN_DELTA) {
      var current = TRANSLATE_RE.exec(rowGroup.style.transform || '');
      if (!current) return;
      setTranslate(
        rowGroup, (parseFloat(current[1]) + delta).toFixed(3), current[2]
      );
    }
    rowGroup.setAttribute(CENTRED, rowGroup.style.transform);
  }

  function scan() {
    var entry = findHeading();
    if (!entry) return;
    if (resize(entry.rowGroup)) centre(entry.rowGroup, entry.canvas);
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
})();
