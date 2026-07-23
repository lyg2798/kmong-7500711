/*
 * Makes the whole envelope on the cover open the invitation.
 *
 * Canva builds the cover's "Open the invitation" target out of 31 separate
 * <a href="#page-1"> elements -- one per glyph, plus a large one behind them.
 * Hit-testing the centre line of the envelope shows that is not the seamless
 * target it looks like: there is a hole roughly 35 x 22px wide, and it sits
 * exactly on the wax seal in the middle of the envelope. Clicking it does
 * nothing. Measured on the live site, every width:
 *
 *     320px  dead y=335~352      360px  dead y=474~493
 *     390px  dead y=500~521      412px  dead y=542~564
 *     430px  dead y=552~575      -- all "no response"
 *
 * The seal is the one thing on that screen that says "open me", so this is the
 * tap a guest is most likely to make first. They get nothing, and nothing
 * distinguishes that from an invitation that failed to load.
 *
 * Rather than move Canva's elements around, this widens the target: a tap
 * anywhere inside the envelope that did not already land on one of the anchors
 * is forwarded to the anchor, so the runtime navigates by its own path.
 */
(function () {
  'use strict';

  var LINK = 'a[href="#page-1"]';

  function anchors() {
    var out = [];
    var all = document.querySelectorAll(LINK);
    for (var i = 0; i < all.length; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ el: all[i], r: r });
    }
    return out;
  }

  // The envelope is the union of the anchors -- Canva gives us no element that
  // means "the envelope", so it has to be derived.
  function envelope(list) {
    if (!list.length) return null;
    var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].r;
      if (r.left < L) L = r.left;
      if (r.top < T) T = r.top;
      if (r.right > R) R = r.right;
      if (r.bottom > B) B = r.bottom;
    }
    return { left: L, top: T, right: R, bottom: B };
  }

  function biggest(list) {
    var best = null, area = 0;
    for (var i = 0; i < list.length; i++) {
      var a = list[i].r.width * list[i].r.height;
      if (a > area) { area = a; best = list[i].el; }
    }
    return best;
  }

  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    // the tap already found a link; let it do its job
    if (e.target && e.target.closest && e.target.closest(LINK)) return;

    var list = anchors();
    if (!list.length) return;
    var env = envelope(list);
    if (!env) return;
    if (e.clientX < env.left || e.clientX > env.right ||
        e.clientY < env.top || e.clientY > env.bottom) return;

    var target = biggest(list);
    if (target) target.click();
  }, true);
})();
