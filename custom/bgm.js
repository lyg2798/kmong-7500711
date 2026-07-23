/*
 * Keeps the background music playing while the reader scrolls.
 *
 * Canva models the music as a *video* node -- it will not take bare audio --
 * and its runtime pauses a video once the section holding it leaves the
 * viewport. Sensible for a video nobody is looking at; this one is the
 * soundtrack, so scrolling down to LOCATION stopped the music and scrolling
 * back up started it again. Measured in WebKit: the element is never removed
 * and its `src` is untouched -- it simply receives `pause`.
 *
 * The first version of this file waited for that `pause` and called `play()`
 * again. It worked, but the round trip left an audible ~30ms hole in the
 * music every time the section scrolled out of view, which is the stutter
 * around LOCATION. So the pause is now declined outright: nothing stops, so
 * there is nothing to restart and no gap to hear.
 *
 * Two pauses are deliberately still allowed through:
 *   - the reader tapping the record's own control. A pause arriving just
 *     after a real tap is theirs, and swallowing it would make the control
 *     useless.
 *   - the page being backgrounded. The runtime pauses on `blur` and resumes
 *     on `focus`; `visibilityState` tells that apart from a scroll, so
 *     switching apps still silences the phone.
 */
(function () {
  'use strict';

  var SRC = 'custom/bgm.mp4';
  var GUARDED = 'data-cg-bgm';

  // A pause this close behind a trusted tap is the reader working the
  // control. Long enough to cover the runtime's own state round-trip, short
  // enough that a tap elsewhere a moment earlier is not mistaken for one.
  var GESTURE_WINDOW = 700;

  var lastGesture = 0;
  function noteGesture(e) {
    if (e.isTrusted) lastGesture = Date.now();
  }
  document.addEventListener('pointerdown', noteGesture, true);
  document.addEventListener('keydown', noteGesture, true);

  var nativePause = HTMLMediaElement.prototype.pause;

  function isBgm(el) {
    return (el.currentSrc || el.src || '').indexOf(SRC) !== -1;
  }

  function guard(el) {
    if (el.getAttribute(GUARDED)) return;
    el.setAttribute(GUARDED, '1');

    // Nothing here may start the music on its own: until the reader's first
    // play there is nothing to protect, so the runtime's gesture gating is
    // left exactly as it is.
    var started = false;
    el.addEventListener('play', function () { started = true; });

    el.pause = function () {
      if (!started) return nativePause.call(el);
      if (Date.now() - lastGesture < GESTURE_WINDOW) {
        started = false;                    // the reader stopped it on purpose
        return nativePause.call(el);
      }
      if (document.visibilityState !== 'visible') {
        return nativePause.call(el);        // backgrounded; `focus` resumes it
      }
      // the runtime pausing an off-screen video -- this one is the music
    };
  }

  function scan() {
    var videos = document.getElementsByTagName('video');
    for (var i = 0; i < videos.length; i++) {
      if (isBgm(videos[i])) guard(videos[i]);
    }
  }

  scan();
  // The element is only created on the first pointer input and its `src` is
  // assigned after insertion, so both have to be caught.
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
})();
