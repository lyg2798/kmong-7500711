/*
 * Keeps the background music playing while the reader scrolls.
 *
 * Canva models the music as a *video* node -- it will not take bare audio --
 * and its runtime pauses a video once the section holding it leaves the
 * viewport. That is sensible for a video nobody is looking at, but this
 * particular element is the soundtrack, so scrolling down to LOCATION stopped
 * the music and scrolling back up started it again. Measured in WebKit: the
 * element is never removed from the document and its `src` is untouched --
 * `connected` stays true throughout -- it simply receives `pause`, then `play`
 * again on the way back up. So the fix is not to keep the element alive but to
 * decline that one pause.
 *
 * Two pauses we deliberately do NOT undo:
 *   - the reader tapping the record's own control. A pause arriving just after
 *     a real tap is theirs, and re-starting it would make the control useless.
 *   - the page being backgrounded. The runtime pauses on `blur` and resumes on
 *     `focus`; `visibilityState` tells the two cases apart, so switching apps
 *     still silences the phone the way a reader expects.
 */
(function () {
  'use strict';

  var SRC = 'custom/bgm.mp4';
  var WATCHED = 'data-cg-bgm';

  // A pause this close behind a trusted tap is the reader working the control.
  // Generous enough to cover the runtime's own state round-trip, short enough
  // that a tap somewhere else on the page a moment earlier is not mistaken for
  // one -- and an unrelated tap only costs one resume, on the next pause.
  var GESTURE_WINDOW = 700;

  var lastGesture = 0;
  function noteGesture(e) {
    if (e.isTrusted) lastGesture = Date.now();
  }
  document.addEventListener('pointerdown', noteGesture, true);
  document.addEventListener('keydown', noteGesture, true);

  function isBgm(el) {
    return (el.currentSrc || el.src || '').indexOf(SRC) !== -1;
  }

  function watch(el) {
    if (el.getAttribute(WATCHED)) return;
    el.setAttribute(WATCHED, '1');

    // Only resume something the reader actually started. Before the first
    // play this stays false, so nothing here can make the music start on its
    // own -- the runtime's gesture gating is left exactly as it is.
    var wanted = false;

    el.addEventListener('play', function () { wanted = true; });

    el.addEventListener('pause', function () {
      if (Date.now() - lastGesture < GESTURE_WINDOW) { wanted = false; return; }
      if (!wanted) return;
      if (document.visibilityState !== 'visible') return;
      el.play().catch(function () {});
    });
  }

  function scan() {
    var videos = document.getElementsByTagName('video');
    for (var i = 0; i < videos.length; i++) {
      if (isBgm(videos[i])) watch(videos[i]);
    }
  }

  scan();
  // The element is only created on the first pointer input, and its `src` is
  // assigned after it is inserted, so both the insertion and the later
  // attribute write have to be caught.
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
})();
