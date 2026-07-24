/*
 * Replaces the record player with a "Save the Date" line.
 *
 * The music now starts from the envelope and stays on, so the record's
 * play/pause control is gone; an elegant script line takes its place.
 *
 * The record is not one element but several overlapping Canva subtrees -- the
 * vinyl gif, the curved "CLICK TO PLAY", and the play-triangle control, which
 * sit at the same spot in different branches and re-assert their own
 * visibility, so hiding a parent does not hide them. It is removed by dropping
 * the gif (by file) and every small element stacked at the control's centre.
 *
 * The line is dropped into the section canvas at the record's own position,
 * expressed as a percentage of the canvas, so it tracks Canva's responsive
 * layout the same way the record did.
 */
(function () {
  'use strict';

  var DISC = '25c11e232ed05049fca21b437993b044';   // the vinyl gif
  var MARK = 'data-cg-std';
  var stdPct = null;        // {x,y} of the record centre within its canvas
  var stdCanvas = null;     // the section canvas the line lives in

  // Taken from the client's own Canva page, which now shows this exact line
  // where the record used to be: font 3f1d60…woff, colour rgb(120,105,56),
  // ~77px with 4px tracking, on two tight lines.
  var style = document.createElement('style');
  style.textContent =
    "@font-face{font-family:cgStd;src:url('custom/savethedate.woff') format('woff');font-display:swap}" +
    '[' + MARK + ']{position:absolute;transform:translate(-50%,-50%);z-index:6;text-align:center;' +
      "font-family:cgStd,'Snell Roundhand','Apple Chancery',cursive;color:rgb(120,105,56);" +
      'line-height:0.72;letter-spacing:0.18vw;pointer-events:none;white-space:nowrap}' +
    '[' + MARK + '] span{display:block;font-size:5.8vw}';
  (document.head || document.documentElement).appendChild(style);

  function findDisc() {
    var imgs = document.getElementsByTagName('img');
    for (var i = 0; i < imgs.length; i++) {
      var s = imgs[i].currentSrc || imgs[i].src || '';
      if (s.indexOf(DISC) !== -1 && imgs[i].getBoundingClientRect().width > 0) return imgs[i];
    }
    return null;
  }

  function ensureLine() {
    if (!stdCanvas) return;
    var std = stdCanvas.querySelector('[' + MARK + ']');
    if (!std) {
      std = document.createElement('div');
      std.setAttribute(MARK, '1');
      std.innerHTML = '<span>Save</span><span>theDate</span>';
      stdCanvas.appendChild(std);
    }
    if (stdPct) {
      std.style.left = stdPct.x + '%';
      std.style.top = stdPct.y + '%';
    }
  }

  function hideRecord() {
    var imgs = document.getElementsByTagName('img');
    for (var i = 0; i < imgs.length; i++) {
      if ((imgs[i].currentSrc || imgs[i].src || '').indexOf(DISC) !== -1) {
        imgs[i].style.setProperty('display', 'none', 'important');
      }
    }
    var btns = document.querySelectorAll('button[aria-label="재생"]');
    for (var j = 0; j < btns.length; j++) {
      var r = btns[j].getBoundingClientRect();
      if (r.width <= 0) continue;
      var cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
        // off-screen: hide the widget by climbing while it stays widget-sized
        var n = btns[j], top = btns[j];
        for (var k = 0; k < 5 && n; k++) {
          if (n.getBoundingClientRect().width < 160) { top = n; n = n.parentElement; } else break;
        }
        top.style.setProperty('display', 'none', 'important');
        continue;
      }
      var stack = document.elementsFromPoint(cx, cy);
      for (var m = 0; m < stack.length; m++) {
        var el = stack[m];
        if (el.hasAttribute && el.hasAttribute(MARK)) continue;         // never our own line
        if (el.closest && el.closest('[' + MARK + ']')) continue;
        var w = el.getBoundingClientRect().width;
        if (w > 0 && w < 110 && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
          el.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  function apply() {
    var disc = findDisc();
    if (disc && disc.closest) {
      var canvas = disc.closest('._mXnjA');
      if (canvas) {
        var dr = disc.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
        if (cr.width > 0) {
          stdCanvas = canvas;
          // the record's centre, nudged up/left to where the client's own page
          // puts the "Save the Date" (matched against a screenshot of it).
          stdPct = {
            x: +((((dr.left + dr.width / 2) - cr.left) / cr.width * 100) - 1.4).toFixed(3),
            y: +((((dr.top + dr.height / 2) - cr.top) / cr.height * 100) - 2.05).toFixed(3)
          };
        }
      }
    }
    ensureLine();
    hideRecord();
  }

  apply();
  // The record is built on the first pointer input and its gif src is set after
  // insertion, so both the node and the src attribute have to be watched. Style
  // is deliberately not observed -- hideRecord writes styles, and watching them
  // would loop.
  new MutationObserver(apply).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
  window.addEventListener('resize', apply);
})();
