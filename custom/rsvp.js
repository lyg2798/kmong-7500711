/*
 * Native RSVP form.
 *
 * The invitation's RSVP was a Canva-hosted form widget. Canva refuses to let
 * that widget render inside any page not on its own domain
 * (X-Frame-Options: SAMEORIGIN), so on this mirror the widget is blank. The
 * earlier fix put a button there that opened the original Canva form in a new
 * tab -- which only works while the client keeps their Canva site published,
 * and drops every response into a Canva account they have to know how to read.
 *
 * This replaces that with a form we own: a rebuild of the exact Canva RSVP
 * (same five fields, same look), submitting to the couple's own Google Sheet
 * through a Google Apps Script web app. No Canva dependency; responses land in
 * a sheet they open with one link.
 *
 * The Canva widget is still found and neutralised here (hidden + pointed at
 * about:blank) and our form is inserted in its place, kept mounted through the
 * runtime's re-renders by a MutationObserver -- the same way the other custom
 * modules survive a resize.
 *
 * The seal and the "We'd love for you to be part of our celebration" line
 * above the form, and the footer below it, are page-level Canva elements, so
 * they render on their own; only the widget (the white field card) is ours.
 */
(function () {
  'use strict';

  // Google Apps Script web-app URL that appends a row to the couple's sheet.
  var RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzXVf0dQFh15azoXQYP4EBVpBkmddwjaPHlqfwzfz-gpRQsvmD-roAmwvO0KyW6qcdq/exec';

  var GUARD = 'data-cg-rsvp';
  var STYLE_ID = 'cg-rsvp-style';

  // Exactly the Canva form's fields, in the Canva order.
  var NAME_LABEL = '성함';
  var GROUPS = [
    { key: 'side',   label: '어느 쪽 하객이신가요?', options: ['신랑측', '신부측'] },
    { key: 'attend', label: '참석 여부',            options: ['참석', '불참', '미정'] },
    { key: 'count',  label: '참석 인원',            options: ['1명', '2명', '3명 이상'] },
    { key: 'meal',   label: '식사 여부',            options: ['O', 'X'] }
  ];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.cg-rsvp{width:100%;box-sizing:border-box;font-family:inherit;background:#fffdfb;',
      'border-radius:14px;padding:24px 20px;box-shadow:0 1px 4px rgba(140,120,90,.07);}',
      '.cg-rsvp-form{display:flex;flex-direction:column;gap:20px;}',
      '.cg-rsvp-field{display:flex;flex-direction:column;gap:9px;}',
      '.cg-rsvp-label{font-size:15px;color:#847a6b;letter-spacing:.02em;}',
      '.cg-rsvp-input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e2d8c9;',
      'border-radius:8px;background:#fff;color:#5c4f40;font-size:15px;font-family:inherit;outline:none;}',
      '.cg-rsvp-input:focus{border-color:#c9b596;}',
      '.cg-rsvp-opts{display:flex;flex-direction:column;gap:8px;}',
      '.cg-rsvp-opt{width:100%;box-sizing:border-box;text-align:left;padding:13px 16px;',
      'border:1px solid transparent;border-radius:8px;background:#f2ede4;color:#8a7c6a;',
      'font-size:15px;font-family:inherit;cursor:pointer;-webkit-appearance:none;appearance:none;',
      'transition:background .15s,border-color .15s,color .15s;}',
      '.cg-rsvp-opt[aria-checked=true]{background:#e7d9c1;border-color:#cdb593;color:#5c4f40;}',
      '.cg-rsvp-submit{margin-top:4px;padding:14px;border:none;border-radius:26px;background:#c6b291;',
      'color:#fffaf4;font-size:16px;font-family:inherit;letter-spacing:.06em;cursor:pointer;',
      'transition:background .15s,opacity .15s;}',
      '.cg-rsvp-submit:hover{background:#bda684;}',
      '.cg-rsvp-submit:disabled{opacity:.55;cursor:default;}',
      '.cg-rsvp-msg{min-height:1em;font-size:13px;line-height:1.5;color:#b08f6f;text-align:center;}',
      '.cg-rsvp-done{padding:28px 8px;text-align:center;color:#847a6b;font-size:16px;line-height:1.8;}'
    ].join('');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function makeGroup(group) {
    var field = document.createElement('div');
    field.className = 'cg-rsvp-field';

    var label = document.createElement('div');
    label.className = 'cg-rsvp-label';
    label.textContent = group.label;
    field.appendChild(label);

    var opts = document.createElement('div');
    opts.className = 'cg-rsvp-opts';
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-label', group.label);

    group.options.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cg-rsvp-opt';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.val = opt;
      b.textContent = opt;
      b.addEventListener('click', function () {
        var chosen = b.getAttribute('aria-checked') === 'true';
        var all = opts.querySelectorAll('.cg-rsvp-opt');
        for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-checked', 'false');
        b.setAttribute('aria-checked', chosen ? 'false' : 'true');
      });
      opts.appendChild(b);
    });
    field.appendChild(opts);
    field._key = group.key;
    field._opts = opts;
    return field;
  }

  function buildForm() {
    injectStyle();

    var root = document.createElement('div');
    root.className = 'cg-rsvp';
    root.setAttribute(GUARD, '1');

    var form = document.createElement('form');
    form.className = 'cg-rsvp-form';
    form.setAttribute('novalidate', '');

    // 성함
    var nameField = document.createElement('div');
    nameField.className = 'cg-rsvp-field';
    var nameLabel = document.createElement('label');
    nameLabel.className = 'cg-rsvp-label';
    nameLabel.textContent = NAME_LABEL;
    var nameInput = document.createElement('input');
    nameInput.className = 'cg-rsvp-input';
    nameInput.type = 'text';
    nameInput.autocomplete = 'name';
    nameInput.setAttribute('aria-label', NAME_LABEL);
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    form.appendChild(nameField);

    var groupFields = GROUPS.map(function (g) {
      var f = makeGroup(g);
      form.appendChild(f);
      return f;
    });

    var submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'cg-rsvp-submit';
    submit.textContent = '제출';
    form.appendChild(submit);

    var msg = document.createElement('div');
    msg.className = 'cg-rsvp-msg';
    msg.setAttribute('aria-live', 'polite');
    form.appendChild(msg);

    function selectedOf(field) {
      var on = field._opts.querySelector('.cg-rsvp-opt[aria-checked=true]');
      return on ? on.dataset.val : '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { name: nameInput.value.trim() };
      groupFields.forEach(function (f) { data[f._key] = selectedOf(f); });

      if (!data.name) { msg.textContent = '성함을 입력해 주세요.'; nameInput.focus(); return; }
      if (!data.attend) { msg.textContent = '참석 여부를 선택해 주세요.'; return; }

      if (!RSVP_ENDPOINT) { msg.textContent = '(미리보기 상태 — 저장 연결 전)'; return; }

      submit.disabled = true;
      msg.textContent = '전송 중...';
      fetch(RSVP_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      }).then(function () {
        showDone(root);
      }).catch(function () {
        submit.disabled = false;
        msg.textContent = '전송에 실패했어요. 잠시 후 다시 시도해 주세요.';
      });
    });

    root.appendChild(form);
    return root;
  }

  function showDone(root) {
    var done = document.createElement('div');
    done.className = 'cg-rsvp-done';
    done.textContent = '참석여부가 전달되었습니다. 감사합니다 :)';
    root.innerHTML = '';
    root.appendChild(done);
  }

  // --- neutralise the Canva widget and keep our form in its place -----------

  function isWidget(el) {
    return el.tagName === 'IFRAME' && el.src && el.src.indexOf('_website-element-widget') !== -1;
  }

  function place(iframe) {
    var prev = iframe.previousElementSibling;
    if (!(prev && prev.hasAttribute && prev.hasAttribute(GUARD))) {
      var parent = iframe.parentNode;
      if (parent) parent.insertBefore(buildForm(), iframe);
    }
    iframe.style.setProperty('display', 'none', 'important');
    iframe.setAttribute('data-cg-rsvp-hidden', '1');
    if (iframe.src !== 'about:blank') iframe.src = 'about:blank';
  }

  function scan() {
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (isWidget(frames[i])) place(frames[i]);
    }
    // drop a form whose hidden widget is gone (page navigated away)
    var forms = document.querySelectorAll('[' + GUARD + ']');
    for (var j = 0; j < forms.length; j++) {
      var next = forms[j].nextElementSibling;
      if (!(next && next.tagName === 'IFRAME' && next.hasAttribute('data-cg-rsvp-hidden'))) {
        if (forms[j].parentNode) forms[j].parentNode.removeChild(forms[j]);
      }
    }
  }

  scan();
  // The widget iframe is created on navigation and its src is set after
  // insertion, so both the node and the attribute have to be watched.
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
})();
