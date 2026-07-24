/*
 * Plays the background music from a real <audio> element instead of from the
 * video node Canva put it in.
 *
 * Canva models music as a *video* -- it will not take bare audio -- and that
 * turned out to cost more than a wasted decode. Measured on the live site over
 * a nine-second scroll down and back, sampling the audio clock against the
 * wall clock:
 *
 *     Chromium   0 pauses   wall 8851ms   audio 8851ms   no loss
 *     WebKit     0 pauses   wall 9033ms   audio 7593ms   lost 1440ms
 *
 * Nothing is pausing it in either engine -- WebKit simply starves an
 * off-screen video's decode, and the audio track rides the same pipeline, so
 * the music drags and stutters while the reader scrolls. That is what the
 * phone was doing around LOCATION. Every browser on iOS is WebKit, so this
 * hits Safari, Chrome and the KakaoTalk in-app browser alike.
 *
 * So the music moves to its own <audio> element, which has no video pipeline
 * to be throttled and belongs to no section that can scroll away. The video
 * node stays exactly where it is and keeps doing its job as the record's
 * play/pause control -- it is just silenced, and this mirrors its state onto
 * the audio.
 *
 * Silencing has to be locked rather than merely set: the runtime's own
 * first-gesture handler assigns `muted = false; volume = 1` to every media
 * element it finds, so a plain assignment here would be undone on the reader's
 * first tap and both tracks would play at once.
 */
(function () {
  'use strict';

  var VIDEO_SRC = 'custom/bgm.mp4';
  var AUDIO_SRC = 'custom/bgm.m4a';
  var GUARDED = 'data-cg-bgm';

  // A pause this close behind a trusted tap is the reader working the
  // control, as opposed to the runtime reacting to a scroll.
  var GESTURE_WINDOW = 700;

  var lastGesture = 0;
  var unlocked = false;

  var audio = document.createElement('audio');
  audio.src = AUDIO_SRC;
  audio.loop = true;
  // 'auto' pulls all 5.9MB before the cover has even been tapped -- on the
  // cover that was 48% of everything the reader was waiting for, spent on
  // music they had not asked for yet. 'metadata' fetches the header now and
  // streams the rest once they start it.
  audio.preload = 'metadata';
  audio.setAttribute('playsinline', '');
  audio.style.display = 'none';

  function attachAudio() {
    if (!audio.parentNode && document.body) document.body.appendChild(audio);
  }
  if (document.body) attachAudio();
  else document.addEventListener('DOMContentLoaded', attachAudio);

  // A media element may only start inside a user gesture. The reader's first
  // tap is the one that opens the envelope, and the client wants the music to
  // begin there -- so rather than merely priming the element, we start it for
  // real inside that gesture and leave it playing. iOS allows an audible
  // play() here because it happens synchronously inside a trusted tap.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    attachAudio();
    audio.muted = false;
    audio.play().catch(function () {});
  }

  function noteGesture(e) {
    if (!e.isTrusted) return;
    lastGesture = Date.now();
    unlock();
  }
  document.addEventListener('pointerdown', noteGesture, true);
  document.addEventListener('keydown', noteGesture, true);

  // Leaving the page has to be handled here now. While the music rode the
  // video element it stopped by itself, because the runtime pauses that
  // element on `blur`; a separate <audio> gets no such treatment and would
  // keep playing in the reader's pocket. `visibilitychange` is the signal
  // that actually fires when a phone switches apps or locks.
  var pausedByHide = false;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (!audio.paused) {
        pausedByHide = true;
        audio.pause();
      }
    } else if (pausedByHide) {
      pausedByHide = false;
      audio.play().catch(function () {});
    }
  });

  var mutedSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted').set;
  var volumeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').set;

  function silence(el) {
    mutedSetter.call(el, true);
    volumeSetter.call(el, 0);
    try {
      Object.defineProperty(el, 'muted', {
        configurable: true,
        get: function () { return true; },
        set: function () {}
      });
      Object.defineProperty(el, 'volume', {
        configurable: true,
        get: function () { return 0; },
        set: function () {}
      });
    } catch (e) {}
  }

  function follow(el) {
    if (el.getAttribute(GUARDED)) return;
    el.setAttribute(GUARDED, '1');
    silence(el);

    el.addEventListener('play', function () {
      attachAudio();
      if (audio.paused) audio.play().catch(function () {});
    });

    // The runtime pauses a video whose section has scrolled out of view. That
    // says nothing about whether the reader wants the music to stop, so only
    // the two pauses that do are passed on.
    el.addEventListener('pause', function () {
      var byReader = Date.now() - lastGesture < GESTURE_WINDOW;
      var backgrounded = document.visibilityState !== 'visible';
      if (byReader || backgrounded) audio.pause();
    });
  }

  function scan() {
    var videos = document.getElementsByTagName('video');
    for (var i = 0; i < videos.length; i++) {
      if ((videos[i].currentSrc || videos[i].src || '').indexOf(VIDEO_SRC) !== -1) {
        follow(videos[i]);
      }
    }
  }

  scan();
  // The video is only created on the first pointer input and its `src` is
  // assigned after insertion, so both have to be caught.
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
})();
