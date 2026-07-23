/*
 * Puts all six section headings -- INVITATION / WEDDING DAY / LOCATION /
 * GALLERY / INFORMATION / 마음 전하실 곳 -- and the ornamental divider under
 * each of them on their section's centre line, and brings the Invitation
 * heading up to the size its siblings render at.
 *
 * All six headings are copies of one design element -- confirmed live: every
 * one of them is a 717.539 x 33.4 text box at font-size 28px, and Canva sizes
 * them by scaling that box down into whatever frame the design gives it. Five
 * of the six sit in a 611.6px frame and so render at scale 0.85237;
 * INVITATION was left in a 280.5px frame, i.e. scale 0.390875 -- about 46% of
 * its siblings. Nothing about the text differs, only its frame. So the resize
 * below doesn't restate a font size: it reads the scale the sibling copies are
 * using and gives this heading the frame that scale implies, which keeps the
 * two in step if the design's heading size is ever changed upstream. Two
 * follow-on corrections:
 *   1. The scale transform grows downward from the frame's top-left origin,
 *      which would eat the 20px the design leaves between a heading and the
 *      divider under it. translateY is pulled back by exactly the height
 *      gained, so the heading grows upward into empty space instead and that
 *      gap survives untouched.
 *   2. The original frame left the word ~12px left of the divider's centre
 *      (the "left weighted" look).
 *
 * Centring then runs over every heading and every divider. Four of the six
 * pairs already sit on the centre line and are measured and left where they
 * are; the two that don't were each checked against the original Canva site
 * first, because the cause differs and is worth recording:
 *   - WEDDING DAY sits 14.1px right of centre, heading and divider together.
 *     The original does exactly the same, so this is the design's own drift
 *     rather than anything the mirror introduced. Corrected on request: it
 *     reads as a mistake next to INVITATION directly above it.
 *   - 마음 전하실 곳 has its divider 73.3px left of centre. In the original the
 *     heading is 73.7px left of centre too -- the pair sits over that section's
 *     left column, which is the design's intent -- but align.js centres the
 *     heading here, which left the divider stranded on its own. Centring the
 *     divider is what puts the pair back in step, and clearBelow() then makes
 *     the room that needs.
 *
 * Canva rewrites these inline styles wholesale on viewport resize (the same
 * behaviour gallery.js, align.js and invitation.js contend with), so every
 * correction is re-applied continuously via MutationObserver and every
 * measurement is taken live -- nothing here is hardcoded. Each correction is
 * also expressed as an absolute position derived from the design's own
 * layout rather than as a nudge, so a pass that runs again writes the same
 * numbers rather than moving anything a second time.
 */
(function () {
  'use strict';

  // The heading's glyphs are small-caps in the design's font, so the stored
  // text is lowercase; matching it exactly rather than by prefix keeps
  // "Return to the Invitation" in the footer out of this. This is also the
  // anchor the other five headings are recognised by: they are copies of the
  // same box, so its declared dimensions identify the whole set.
  var HEADING_TEXT = 'invitation';

  var SCALE_RE = /scale\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/;
  var TRANSLATE_RE = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/;
  // declared sizes closer than this are the same box re-measured
  var SAME_BOX = 0.5;
  // below this a thing is already close enough to where it belongs that
  // re-writing the style would just be floating-point noise
  var MIN_DELTA = 0.5;
  // the divider ornament renders about 32x wider than it is tall; the
  // flattest thing that is not a divider is a line of text at about 10x, so
  // this tells them apart without depending on either one's pixel size
  var FLAT = 15;
  // a divider sits within about one heading-height of the heading above it at
  // every viewport, since gap and heading scale together; twice that is room
  // to spare and still stops the search well short of the section's body
  var NEAR = 2;
  // compare the numbers we wrote, not the strings: the browser re-serialises
  // `transform` and `height`, so a string comparison reports "not mine" on a
  // value this just set -- which is how the same kind of shift in
  // invitation.js ran away to a ~1,000,000px displacement at 768px wide
  // before a numeric check replaced it
  var EPSILON = 0.05;

  var CENTRED = 'data-cg-heading-tx';
  var BASE = 'data-cg-heading-base';
  var SHIFTED = 'data-cg-heading-shift';
  var HEIGHT_BASE = 'data-cg-heading-hbase';
  var GROWN = 'data-cg-heading-grown';

  // ---------------------------------------------------------------- geometry

  function parseTranslate(transform) {
    var m = TRANSLATE_RE.exec(transform || '');
    return m ? { x: m[1], y: m[2] } : null;
  }

  function setTranslate(el, x, y) {
    el.style.transform = el.style.transform.replace(
      TRANSLATE_RE, 'translate(' + x + 'px, ' + y + 'px)'
    );
  }

  function centreOf(el) {
    var r = el.getBoundingClientRect();
    return r.left + r.width / 2;
  }

  // Union of Range.getClientRects() over every non-empty text node in the
  // subtree -- the actual glyph extent, unlike an element's own
  // getBoundingClientRect() which reflects its declared frame.
  //
  // Horizontal only, deliberately. Four of the six headings sit in a `_lzXBg`
  // clip box and are revealed by sliding the text up into it from a line
  // below as their section is scrolled to, so until that has played the ink's
  // *vertical* position is a whole line out: LOCATION's glyphs measured
  // 30.67px down inside a 35.89px box before the reveal and 3.95px down after
  // it. A divider looked for below a bottom edge measured that way lands
  // above the heading it belongs to and is simply never found -- which is
  // what silently dropped the 마음 전하실 곳 fix on some page loads. The clip
  // box itself doesn't move, so everything vertical below is measured off
  // that instead and reads the same whether the section has been reached yet
  // or not. The reveal doesn't touch x -- those same glyphs measured 245.93px
  // from the box's left edge in both states -- so centring stays honest.
  function inkCentreX(el) {
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

  // --------------------------------------------------------------- discovery

  // the design element Canva positions inside a section canvas; everything
  // this file moves is one of these.
  function rowGroupOf(el) {
    var n = el;
    while (n && n.parentElement) {
      if (n.parentElement.classList.contains('_mXnjA')) return n;
      n = n.parentElement;
    }
    return null;
  }

  // Canva keeps alternate-layout copies of whole blocks parked off-screen for
  // other viewports, and those blocks hold a crowd of text boxes inside one
  // row-group. A section heading is always alone in its own row-group, which
  // is what separates the six real ones from the copies.
  function soloBoxes() {
    var found = [];
    var boxes = document.getElementsByClassName('aF9o6Q');
    for (var i = 0; i < boxes.length; i++) {
      var rowGroup = rowGroupOf(boxes[i]);
      if (!rowGroup) continue;
      var inside = rowGroup.getElementsByClassName('aF9o6Q').length +
        (rowGroup.classList.contains('aF9o6Q') ? 1 : 0);
      if (inside !== 1) continue;
      found.push({ inner: boxes[i], rowGroup: rowGroup, canvas: rowGroup.parentElement });
    }
    return found;
  }

  function findHeadings() {
    var boxes = soloBoxes();
    var i;
    var anchor = null;
    for (i = 0; i < boxes.length; i++) {
      if ((boxes[i].inner.textContent || '').trim() === HEADING_TEXT) anchor = boxes[i].inner;
    }
    if (!anchor) return [];
    var w = parseFloat(anchor.style.width);
    var h = parseFloat(anchor.style.height);
    if (isNaN(w) || isNaN(h)) return [];

    var headings = [];
    for (i = 0; i < boxes.length; i++) {
      var inner = boxes[i].inner;
      if (Math.abs(parseFloat(inner.style.width) - w) > SAME_BOX) continue;
      if (Math.abs(parseFloat(inner.style.height) - h) > SAME_BOX) continue;
      headings.push(boxes[i]);
    }
    return headings;
  }

  // The divider is the nearest row-group below the heading that carries no
  // text and is a thin wide strip -- proportions rather than pixel sizes, so
  // the same test holds at every viewport scale, and "no text" is what keeps
  // a single centred line of body copy (which can be just as flat) from being
  // mistaken for one.
  function findDivider(entry) {
    var box = entry.rowGroup.getBoundingClientRect();
    var reach = box.height * NEAR;
    var kids = entry.canvas.children;
    var best = null;
    var bestTop = Infinity;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === entry.rowGroup) continue;
      if ((kids[i].textContent || '').trim()) continue;
      var r = kids[i].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width / r.height < FLAT) continue;
      if (r.top < box.bottom - MIN_DELTA) continue;
      if (r.top - box.bottom > reach) continue;
      if (r.top < bestTop) { best = kids[i]; bestTop = r.top; }
    }
    return best;
  }

  // ------------------------------------------------------------- corrections

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

  // Slides a row-group sideways until `cx` -- whatever the caller decided the
  // element's visual centre is -- lands on the canvas's. The correction is
  // recomputed from that measurement every pass rather than accumulated, so
  // running it on an element that is already centred is a no-op and running
  // it on one Canva has just rewritten puts it straight back. translateY is
  // never touched here: invitation.js owns vertical placement in the
  // Invitation section, and clearBelow() below owns it in 마음 전하실 곳.
  function centre(el, canvas, cx) {
    if (cx === null) return;
    // cx comes from getClientRects(), which is viewport-relative, so the
    // canvas centre has to be too.
    var canvasRect = canvas.getBoundingClientRect();
    // a canvas still being laid out has no centre to speak of; leaving the
    // marker unset means the next pass measures it again rather than treating
    // whatever came out of that as settled
    if (!canvasRect.width) return;
    var delta = (canvasRect.left + canvasRect.width / 2) - cx;
    if (Math.abs(delta) >= MIN_DELTA) {
      var current = parseTranslate(el.style.transform);
      if (!current) return;
      setTranslate(el, (parseFloat(current.x) + delta).toFixed(3), current.y);
    }
    el.setAttribute(CENTRED, el.style.transform);
  }

  function settled(el) {
    return el.getAttribute(CENTRED) === el.style.transform;
  }

  // How much of where this element currently sits was put there by this file,
  // so a measurement can be taken back to the design's own layout. Zero
  // unless the element is still holding the exact number last written to it:
  // if Canva has rewritten the transform since, that value is the design's
  // again and nothing has been applied on top of it.
  function appliedTo(el) {
    var t = parseTranslate(el.style.transform);
    var out = parseFloat(el.getAttribute(SHIFTED));
    var base = parseFloat(el.getAttribute(BASE));
    if (!t || isNaN(out) || isNaN(base)) return 0;
    return Math.abs(parseFloat(t.y) - out) < EPSILON ? out - base : 0;
  }

  // Writes design-position + offset rather than nudging the element along, so
  // running twice writes the same number twice instead of moving it twice. A
  // pass that finds the element back at a design value adopts that as the new
  // base, which is how a viewport change is picked up without anything having
  // to be remembered across it.
  function offsetY(el, offset) {
    var t = parseTranslate(el.style.transform);
    if (!t) return;
    var y = parseFloat(t.y);
    var base = Math.abs(y - parseFloat(el.getAttribute(SHIFTED))) < EPSILON
      ? parseFloat(el.getAttribute(BASE))
      : y;
    if (isNaN(base)) base = y;
    var next = base + offset;
    if (Math.abs(y - next) < EPSILON) return;
    setTranslate(el, t.x, next.toFixed(3));
    el.setAttribute(BASE, base.toFixed(3));
    el.setAttribute(SHIFTED, next.toFixed(3));
  }

  function offsetHeight(el, offset) {
    var current = parseFloat(el.style.height);
    if (isNaN(current)) return;
    var base = Math.abs(current - parseFloat(el.getAttribute(GROWN))) < EPSILON
      ? parseFloat(el.getAttribute(HEIGHT_BASE))
      : current;
    if (isNaN(base)) base = current;
    var next = base + offset;
    if (Math.abs(current - next) < EPSILON) return;
    el.style.height = next.toFixed(3) + 'px';
    el.setAttribute(HEIGHT_BASE, base.toFixed(3));
    el.setAttribute(GROWN, next.toFixed(3));
  }

  function grow(canvas, section, offset) {
    var el = canvas;
    while (el && el !== section.parentElement) {
      if (el.style && el.style.height) offsetHeight(el, offset);
      el = el.parentElement;
    }
  }

  // Canva renders video playback controls into a separate overlay layer that
  // is anchored to the *bottom* of the section and sized to match the canvas,
  // so a control lands on the artwork it belongs to. That layer is a sibling
  // of the canvas's branch, not an ancestor, so grow() never reaches it -- and
  // a section that grew by N slides every control in it down by N. Keeping the
  // layer's height equal to the canvas's is the whole fix, and it self-corrects
  // rather than accumulating, so it needs no bookkeeping of its own.
  function syncControlOverlay(canvas, section) {
    var overlay = section.getElementsByClassName('QhExXw')[0];
    if (!overlay || !canvas.style.height) return;
    if (overlay.style.height !== canvas.style.height) {
      overlay.style.height = canvas.style.height;
    }
  }

  // A divider normally has its row to itself, so centring it changes nothing
  // but its own x. 마음 전하실 곳 is the exception: the design put that
  // section's divider in the left column and the portrait in the right one,
  // both starting on the same line, so a divider brought to the middle runs
  // into the top edge of the photo. This gives it as much air below as the
  // design gives it above and moves the section's body down by however much
  // that takes -- the body as a whole, so its own spacing survives, including
  // the portrait ending flush with the last line of the contacts beside it.
  //
  // Both the trigger and the distance are read off the design's layout, with
  // any offset this file has already applied taken back out first. That
  // matters more than it looks. The obvious version -- trigger on the overlap
  // as it currently stands, then shift by the shortfall -- stops firing the
  // moment it has worked, so when Canva later rewrote some of that section's
  // row-groups and not others, the section was left half-shifted (photo moved
  // down, text and contacts not) with nothing left to notice. Phrased against
  // the design, every pass reaches the same conclusion and re-asserts the same
  // positions whatever state it finds them in.
  function clearBelow(canvas, divider, gapAbove) {
    var section = canvas.closest ? canvas.closest('section') : null;
    if (!section) return;
    var dr = divider.getBoundingClientRect();
    var kids = canvas.children;
    var body = [];
    var i, r, top;

    for (i = 0; i < kids.length; i++) {
      if (kids[i] === divider) continue;
      // no translate of its own: a backdrop or a safe-area marker, which the
      // design sizes rather than places and which this must leave alone
      if (!parseTranslate(kids[i].style.transform)) continue;
      r = kids[i].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      top = r.top - appliedTo(kids[i]);
      if (top < dr.top - MIN_DELTA) continue;
      body.push({ el: kids[i], top: top, left: r.left, right: r.right });
    }
    if (!body.length) return;

    var collides = false;
    var bodyTop = Infinity;
    for (i = 0; i < body.length; i++) {
      if (body[i].top < bodyTop) bodyTop = body[i].top;
      if (body[i].top < dr.bottom &&
          body[i].left < dr.right && body[i].right > dr.left) collides = true;
    }
    // the other five dividers have their row to themselves; leave them be
    if (!collides) return;

    var offset = (dr.bottom + gapAbove) - bodyTop;
    if (offset < MIN_DELTA) return;
    for (i = 0; i < body.length; i++) offsetY(body[i].el, offset);
    grow(canvas, section, offset);
    syncControlOverlay(canvas, section);
  }

  // ------------------------------------------------------------------- pass

  function process(entry) {
    if (!resize(entry.rowGroup)) return;

    if (!settled(entry.rowGroup)) {
      centre(entry.rowGroup, entry.canvas, inkCentreX(entry.rowGroup));
    }

    var divider = findDivider(entry);
    if (!divider) return;
    if (!settled(divider)) centre(divider, entry.canvas, centreOf(divider));

    // the room the design leaves between the heading's box and the divider,
    // which is what clearBelow() then matches underneath it
    var gapAbove = divider.getBoundingClientRect().top -
      entry.rowGroup.getBoundingClientRect().bottom;
    clearBelow(entry.canvas, divider, gapAbove);
  }

  function scan() {
    var headings = findHeadings();
    for (var i = 0; i < headings.length; i++) process(headings[i]);
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
})();
