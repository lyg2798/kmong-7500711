/*
 * Custom GALLERY section replacement: swaps the Canva photo collage for a
 * preview + horizontal thumbnail strip + fullscreen lightbox, without
 * modifying any Canva-authored asset. Mounted identically on all 3 pages
 * because the site is an SPA: main-page's DOM can be reached by navigating
 * from index.html or address-collection.html without a fresh document load.
 *
 * The Canva runtime rewrites the gallery section's inline styles wholesale
 * on viewport resize (confirmed empirically: it resets display, opacity and
 * height together, not just the properties it "owns"), so everything here
 * is re-applied continuously via MutationObserver rather than applied once.
 */
(function () {
  'use strict';

  var SECTION_ID = 'PBYzMTLgcJwkz5Ld';
  var BOTTOM_MARGIN = 40;

  var PHOTOS = [
    '_assets/media/794702011abaac93d16e078df7404603.jpg',
    '_assets/media/354b0b6806f4b317f1a080c16001af61.jpg',
    '_assets/media/a13654e94f8e82561aa9bbdcb0782828.jpg',
    '_assets/media/7e7996523dbceb212b46502258c613f0.jpg',
    '_assets/media/a82bce9d9189aca3d57da0f1730fc0d0.jpg',
    '_assets/media/bb4642226dc6b83764e2bc5fa91c5952.jpg',
    '_assets/media/3c6030ff45b87d4572208cd473d92aef.jpg',
    '_assets/media/b9251585a29695f0620fa4f9ec11af51.jpg',
    '_assets/media/9bc15f702a6d120770fa3e4dbf6033fa.jpg',
    '_assets/media/5a560770836c1ab5fe6ffff94e9927ae.jpg',
    '_assets/media/55a0002efe306324b3ddfc657a2db48c.jpg',
    '_assets/media/f65e9229e7ee7c6e87fe10a08eb74ba7.jpg'
  ];

  var state = {
    selectedIndex: 0,
    lightboxOpen: false,
    lightboxIndex: 0
  };

  var refs = {
    container: null,
    previewImg: null,
    strip: null,
    thumbs: [],
    lightbox: null,
    track: null,
    slides: [],
    counter: null,
    savedScrollerOverflow: null,
    lastSizerHeight: null
  };

  // ---------- locating the gallery section (defensive) ----------

  function findGallerySection() {
    var byId = document.getElementById(SECTION_ID);
    if (byId && byId.tagName === 'SECTION') return byId;
    var sections = document.querySelectorAll('section');
    for (var i = 0; i < sections.length; i++) {
      if (sectionHasGalleryHeading(sections[i])) return sections[i];
    }
    return null;
  }

  function sectionHasGalleryHeading(section) {
    var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === 'GALLERY') return true;
    }
    return false;
  }

  function isKnownGalleryPhotoSrc(src) {
    if (!src) return false;
    for (var i = 0; i < PHOTOS.length; i++) {
      var filename = PHOTOS[i].slice(PHOTOS[i].lastIndexOf('/') + 1);
      if (src.indexOf(filename) !== -1) return true;
    }
    return false;
  }

  // the section canvas that holds the heading, divider and photo row-groups
  // as position:absolute siblings (class name is stable for this frozen
  // static snapshot; matched by class rather than by structural depth so a
  // change in wrapper nesting doesn't break this).
  function findCanvas(section) {
    var byClass = section.getElementsByClassName('_mXnjA')[0];
    if (byClass) return byClass;
    return null;
  }

  function findSizer(section) {
    return section.getElementsByClassName('_8jGYJw')[0] || null;
  }

  // row-groups = direct children of the canvas that contain at least one of
  // our known gallery photos. Matched by content, not position, so this
  // keeps working even if Canva's wrapper count/order around them changes.
  function findPhotoRowGroups(canvas) {
    var groups = [];
    var children = canvas.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      // our own injected container reuses the same photo filenames for its
      // thumbnails/preview, so it must be excluded here or it would match
      // itself as a "row-group" and get hidden.
      if (child === refs.container || child.classList.contains('cg-root')) continue;
      var imgs = child.querySelectorAll('img');
      for (var j = 0; j < imgs.length; j++) {
        if (isKnownGalleryPhotoSrc(imgs[j].getAttribute('src'))) {
          groups.push(child);
          break;
        }
      }
    }
    return groups;
  }

  // bottom edge (in px, relative to canvas top) of whatever Canva content is
  // being kept (heading + decorative divider) -- measured fresh every time,
  // never hardcoded. Full-height background/frame layers are excluded via a
  // size heuristic: the heading and divider are both under 100px tall, the
  // background/frame layers span the section's original ~1500px height.
  function getContentBottomY(canvas, rowGroups) {
    var canvasTop = canvas.getBoundingClientRect().top;
    var maxBottom = 0;
    var children = canvas.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (rowGroups.indexOf(child) !== -1) continue;
      if (child.classList.contains('cg-root')) continue;
      var rect = child.getBoundingClientRect();
      if (rect.height > 100) continue;
      var relBottom = rect.bottom - canvasTop;
      if (relBottom > maxBottom) maxBottom = relBottom;
    }
    return maxBottom;
  }

  // ---------- gallery UI (preview + thumbnail strip) ----------

  function buildGalleryUI() {
    var root = document.createElement('div');
    root.className = 'cg-root';

    var preview = document.createElement('div');
    preview.className = 'cg-preview';
    var previewImg = document.createElement('img');
    previewImg.alt = '';
    preview.appendChild(previewImg);
    preview.addEventListener('click', function () {
      openLightbox(state.selectedIndex);
    });
    root.appendChild(preview);
    refs.previewImg = previewImg;

    var stripWrap = document.createElement('div');
    stripWrap.className = 'cg-strip-wrap';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'cg-chevron cg-chevron--prev';
    prevBtn.setAttribute('aria-label', '이전 사진 목록');
    prevBtn.textContent = '‹';
    prevBtn.addEventListener('click', function () { scrollStrip(-1); });

    var strip = document.createElement('div');
    strip.className = 'cg-strip';
    refs.thumbs = [];
    PHOTOS.forEach(function (src, i) {
      var thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'cg-thumb';
      thumb.setAttribute('aria-label', (i + 1) + '번째 사진');
      var img = document.createElement('img');
      img.src = src;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.alt = '';
      thumb.appendChild(img);
      thumb.addEventListener('click', function () { selectPhoto(i); });
      strip.appendChild(thumb);
      refs.thumbs.push(thumb);
    });
    refs.strip = strip;

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'cg-chevron cg-chevron--next';
    nextBtn.setAttribute('aria-label', '다음 사진 목록');
    nextBtn.textContent = '›';
    nextBtn.addEventListener('click', function () { scrollStrip(1); });

    stripWrap.appendChild(prevBtn);
    stripWrap.appendChild(strip);
    stripWrap.appendChild(nextBtn);
    root.appendChild(stripWrap);

    return root;
  }

  function scrollStrip(direction) {
    var strip = refs.strip;
    if (!strip) return;
    var firstThumb = refs.thumbs[0];
    var thumbStep = 80;
    if (firstThumb) {
      var cs = getComputedStyle(strip);
      var gap = parseFloat(cs.columnGap || cs.gap || '8') || 8;
      thumbStep = firstThumb.getBoundingClientRect().width + gap;
    }
    strip.scrollBy({ left: thumbStep * 3 * direction, behavior: 'smooth' });
  }

  function selectPhoto(index) {
    if (index < 0 || index >= PHOTOS.length) return;
    state.selectedIndex = index;
    if (refs.previewImg) refs.previewImg.src = PHOTOS[index];
    refs.thumbs.forEach(function (t, i) {
      if (i === index) t.classList.add('is-selected');
      else t.classList.remove('is-selected');
    });
    var selectedThumb = refs.thumbs[index];
    if (selectedThumb) selectedThumb.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  // ---------- lightbox ----------

  function buildLightbox() {
    var root = document.createElement('div');
    root.className = 'cg-lightbox';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cg-lightbox-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeLightbox);

    var counter = document.createElement('div');
    counter.className = 'cg-lightbox-counter';
    refs.counter = counter;

    var prevArrow = document.createElement('button');
    prevArrow.type = 'button';
    prevArrow.className = 'cg-lightbox-arrow cg-lightbox-arrow--prev';
    prevArrow.setAttribute('aria-label', '이전 사진');
    prevArrow.textContent = '‹';
    prevArrow.addEventListener('click', function () {
      goToLightboxSlide(state.lightboxIndex - 1, true);
    });

    var nextArrow = document.createElement('button');
    nextArrow.type = 'button';
    nextArrow.className = 'cg-lightbox-arrow cg-lightbox-arrow--next';
    nextArrow.setAttribute('aria-label', '다음 사진');
    nextArrow.textContent = '›';
    nextArrow.addEventListener('click', function () {
      goToLightboxSlide(state.lightboxIndex + 1, true);
    });

    var track = document.createElement('div');
    track.className = 'cg-lightbox-track';
    refs.slides = [];
    PHOTOS.forEach(function (src, i) {
      var slide = document.createElement('div');
      slide.className = 'cg-lightbox-slide';
      var img = document.createElement('img');
      img.alt = '';
      slide.appendChild(img);
      slide.addEventListener('click', function (e) {
        if (e.target === slide) closeLightbox();
      });
      track.appendChild(slide);
      refs.slides.push({ img: img, src: src, loaded: false });
    });
    refs.track = track;

    var scrollTimer = null;
    track.addEventListener('scroll', function () {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var w = track.clientWidth || 1;
        var idx = Math.round(track.scrollLeft / w);
        if (idx !== state.lightboxIndex && idx >= 0 && idx < PHOTOS.length) {
          state.lightboxIndex = idx;
          updateLightboxUI();
        }
      }, 80);
    });

    root.appendChild(closeBtn);
    root.appendChild(counter);
    root.appendChild(prevArrow);
    root.appendChild(track);
    root.appendChild(nextArrow);

    document.body.appendChild(root);
    return root;
  }

  function ensureSlideLoaded(index) {
    var slide = refs.slides[index];
    if (slide && !slide.loaded) {
      slide.img.src = slide.src;
      slide.loaded = true;
    }
  }

  function updateLightboxUI() {
    if (refs.counter) {
      refs.counter.textContent = (state.lightboxIndex + 1) + ' / ' + PHOTOS.length;
    }
    ensureSlideLoaded(state.lightboxIndex);
    ensureSlideLoaded(Math.max(0, state.lightboxIndex - 1));
    ensureSlideLoaded(Math.min(PHOTOS.length - 1, state.lightboxIndex + 1));
  }

  function goToLightboxSlide(index, smooth) {
    if (index < 0 || index >= PHOTOS.length) return;
    state.lightboxIndex = index;
    var track = refs.track;
    if (!track) return;
    var w = track.clientWidth;
    track.scrollTo({ left: w * index, behavior: smooth ? 'smooth' : 'auto' });
    updateLightboxUI();
  }

  function onLightboxKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') goToLightboxSlide(state.lightboxIndex - 1, true);
    else if (e.key === 'ArrowRight') goToLightboxSlide(state.lightboxIndex + 1, true);
  }

  function onWindowResizeForLightbox() {
    if (state.lightboxOpen) goToLightboxSlide(state.lightboxIndex, false);
  }

  function openLightbox(index) {
    if (!refs.lightbox) refs.lightbox = buildLightbox();
    state.lightboxOpen = true;
    refs.lightbox.classList.add('is-open');
    document.addEventListener('keydown', onLightboxKeydown);
    var scroller = document.querySelector('.ZRRuDw');
    if (scroller) {
      refs.savedScrollerOverflow = scroller.style.overflow;
      scroller.style.overflow = 'hidden';
    }
    goToLightboxSlide(index, false);
  }

  function closeLightbox() {
    state.lightboxOpen = false;
    if (refs.lightbox) refs.lightbox.classList.remove('is-open');
    document.removeEventListener('keydown', onLightboxKeydown);
    var scroller = document.querySelector('.ZRRuDw');
    if (scroller) {
      scroller.style.overflow = refs.savedScrollerOverflow || '';
    }
    selectPhoto(state.lightboxIndex);
  }

  // ---------- mount / continuous re-apply ----------

  function positionContainerAndSizer(section, canvas, rowGroups) {
    var canvasRect = canvas.getBoundingClientRect();
    var topY = getContentBottomY(canvas, rowGroups);

    var newTop = topY + 'px';
    if (refs.container.style.top !== newTop) refs.container.style.top = newTop;

    var containerHeight = refs.container.getBoundingClientRect().height;
    var totalHeight = Math.round(topY + containerHeight + BOTTOM_MARGIN);
    var newHeightStr = totalHeight + 'px';

    var sizer = findSizer(section);
    if (sizer && sizer.style.height !== newHeightStr) {
      sizer.style.height = newHeightStr;
      refs.lastSizerHeight = newHeightStr;
    }
  }

  function mountIfNeeded() {
    var section = findGallerySection();
    if (!section) return;
    var canvas = findCanvas(section);
    if (!canvas) return;
    var rowGroups = findPhotoRowGroups(canvas);
    if (rowGroups.length === 0) return;

    var containerExists = !!(refs.container && canvas.contains(refs.container));

    var needsHide = false;
    for (var i = 0; i < rowGroups.length; i++) {
      if (rowGroups[i].style.display !== 'none') { needsHide = true; break; }
    }

    var sizer = findSizer(section);
    var sizerDrifted = !!(sizer && refs.lastSizerHeight && sizer.style.height !== refs.lastSizerHeight);

    if (!containerExists || needsHide || sizerDrifted) {
      if (needsHide || !containerExists) {
        rowGroups.forEach(function (g) {
          if (g.style.display !== 'none') {
            g.style.setProperty('display', 'none', 'important');
          }
        });
      }
      if (!containerExists) {
        refs.container = buildGalleryUI();
        canvas.appendChild(refs.container);
        selectPhoto(state.selectedIndex);
      }
      positionContainerAndSizer(section, canvas, rowGroups);
    }
  }

  function scan() {
    mountIfNeeded();
  }

  scan();
  window.addEventListener('resize', onWindowResizeForLightbox);
  var observer = new MutationObserver(function () { scan(); });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
})();
