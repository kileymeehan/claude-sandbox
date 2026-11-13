// Kiley Daniel Meehan, portfolio. Small enhancements only:
//   1. Theme toggle (dark default, light by preference or by choice)
//   2. Profile flip card
//   3. Case-story links (password-protected stories site)
//   4. Fade-in reveals
//   5. Recommendations carousel (home)
//   6. CMS-backed writing lists (home + writing page), via /api/posts

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- 1. Theme toggle ----
  var themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      var next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // ---- 2. Profile flip card ----
  var profile = document.querySelector('.profile');
  if (profile) {
    var front = profile.querySelector('.front'), back = profile.querySelector('.back');
    profile.querySelectorAll('.flip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = profile.classList.toggle('flipped');
        front.inert = on; back.inert = !on;
        (on ? back : front).querySelector('.flip-btn').focus({ preventScroll: true });
      });
    });
  }
  if (reduceMotion) {
    document.querySelectorAll('video.pav-lg, video.brand-av').forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
  }

  // ---- 3. Case-story links ----
  // The stories live on their own password-protected site. While developing
  // locally, point at the case-stories project served by Launchpad instead.
  var isLocal = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
  var STORIES_URL = isLocal ? 'http://localhost:8107/' : 'https://stories.kileymeehan.com/';
  document.querySelectorAll('[data-story]').forEach(function (a) {
    a.href = STORIES_URL + a.getAttribute('data-story');
  });

  // ---- 4. Fade-in reveals ----
  var reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { revealer.observe(el); });
  }

  // ---- Footer cat: wakes now and then, and when tapped (hover is pure CSS) ----
  document.querySelectorAll('.footer-cat').forEach(function (cat) {
    var napTimer;
    function wake(ms) {
      cat.classList.add('is-awake');
      clearTimeout(napTimer);
      napTimer = setTimeout(function () { cat.classList.remove('is-awake'); }, ms);
    }
    cat.addEventListener('click', function () { wake(3000); });
    if (reduceMotion) return;
    (function doze() {
      setTimeout(function () { wake(2200 + Math.random() * 1200); doze(); }, 8000 + Math.random() * 7000);
    })();
  });

  // ---- 5. Recommendations carousel ----
  // ---- Talking portraits ----
  // Each face is a canvas: the portrait, plus eyelids painted in the skin tone sampled
  // just above each eye (blink) and a dark sliver along the lip line (speaking).
  // Coordinates are in the 480px source image (assets/people/pN.jpg).
  var FACES = {
    p1: { view: [150, 150, 320], eyes: [[260, 302, 40, 19], [342, 277, 36, 25]], mouth: [300, 381, 58] },
    p2: { eyes: [[264, 221, 28, 14], [346, 197, 28, 12]], mouth: [282, 305, 48] },
    p3: { eyes: [[243, 207, 46, 15], [321, 185, 42, 16]], mouth: [290, 281, 42] },
    p4: { eyes: [[256, 212, 40, 15], [337, 191, 34, 15]], mouth: [300, 292, 50] },
    p5: { eyes: [[267, 202, 36, 14], [351, 183, 34, 14]], mouth: [308, 283, 44] },
    p6: { eyes: [[253, 204, 44, 20], [338, 191, 34, 14]], mouth: [292, 286, 58] },
    p7: { eyes: [[260, 195, 32, 13], [341, 169, 30, 15]], mouth: [295, 268, 65] },
    p8: { eyes: [[252, 210, 34, 18], [333, 191, 32, 18]], mouth: [302, 283, 54] }
  };
  function faceImage(id, talk) {
    var f = FACES[id], key = talk ? 'talkImg' : 'img';
    if (!f[key]) { f[key] = new Image(); f[key].src = '/assets/people/' + id + (talk ? '-talk' : '') + '.jpg'; }
    return f[key];
  }
  // The open-mouth frame, cut to a soft oval around the mouth and jaw so that
  // nothing else on the face shifts when it is blended in.
  function mouthLayer(id) {
    var f = FACES[id], talk = faceImage(id, true);
    if (f.layer) return f.layer;
    if (!talk.complete || !talk.naturalWidth) return null;
    var c = document.createElement('canvas'); c.width = c.height = 480;
    var x = c.getContext('2d'), m = f.mouth, cx = m[0] + m[2] / 2, cy = m[1] + 6, r = m[2] * 0.95 + 14;
    x.drawImage(talk, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    x.translate(cx, cy); x.scale(1, 0.8);
    var g = x.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2);
    return (f.layer = c);
  }
  function sample(ctx, x, y) {
    var d = ctx.getImageData(x - 2, y - 2, 5, 5).data, r = 0, g = 0, b = 0, n = d.length / 4;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return [r / n, g / n, b / n];
  }
  function rgb(c, k) { return 'rgb(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ')'; }
  // blink: 0 (open) .. 1 (shut); mouth: 0 (closed) .. 1 (open-mouth frame fully blended in)
  function drawFace(canvas, id, blink, mouth) {
    var f = FACES[id], img = faceImage(id), ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!img.complete || !img.naturalWidth) return false;
    // Zoom in on the face: view = [x, y, size] of the source square to show.
    var v = f.view || [130, 70, 340], k = canvas.width / v[2];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#f3ece1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, -v[0] * k, -v[1] * k);
    ctx.globalCompositeOperation = 'multiply';
    // Compose closed + open mouth in source space first, then multiply onto the tint once.
    var frame = f.frame || (f.frame = document.createElement('canvas'));
    frame.width = frame.height = 480;
    var fx = frame.getContext('2d');
    fx.drawImage(img, 0, 0);
    var layer = mouth > 0 && mouthLayer(id);
    if (layer) { fx.globalAlpha = Math.min(1, mouth); fx.drawImage(layer, 0, 0); fx.globalAlpha = 1; }
    ctx.drawImage(frame, 0, 0, 480, 480);
    ctx.globalCompositeOperation = 'source-over';
    if (!f.lids) f.lids = f.eyes.map(function (e) { return sample(ctx, (e[0] + e[2] / 2 - v[0]) * k, (e[1] + e[3] + 5 - v[1]) * k); });
    if (blink > 0) f.eyes.forEach(function (e, i) {
      var h = Math.round(e[3] * blink);
      ctx.fillStyle = rgb(f.lids[i], 1); ctx.fillRect(e[0], e[1], e[2], h);
      ctx.fillStyle = rgb(f.lids[i], .55); ctx.fillRect(e[0], e[1] + h - 2, e[2], 2);
    });
    return true;
  }

  // Blink every few seconds, and "speak" each quote: the mouth follows the
  // letters (open on vowels, half on consonants, shut between words, longer
  // rests at punctuation), then calls done() so the carousel can move on.
  function speechTrack(text) {
    var beats = [], ms = 80;
    text.replace(/[“”"]/g, '').split('').forEach(function (ch) {
      var c = ch.toLowerCase();
      if ('aou'.indexOf(c) > -1) beats.push([1, ms]);
      else if ('eiy'.indexOf(c) > -1) beats.push([0.75, ms]);
      else if (/[a-z0-9']/.test(c)) beats.push([0.3, ms * 0.8]);
      else if (c === ' ') beats.push([0, ms * 0.7]);
      else if (/[.!?]/.test(c)) beats.push([0, 420]);
      else if (/[,;:—–-]/.test(c)) beats.push([0, 240]);
    });
    // merge runs so the jaw moves in syllables rather than letter by letter
    var out = [];
    beats.forEach(function (b) {
      var last = out[out.length - 1];
      // also fold very short beats into the previous one, so the jaw never flaps
      // faster than about 7 times a second
      if (last && (Math.abs(last[0] - b[0]) < 0.3 || last[1] < 140)) { last[1] += b[1]; last[0] = Math.max(last[0], b[0]); }
      else out.push([b[0], b[1]]);
    });
    return out;
  }
  function talkingFace(canvas) {
    var id = null, blink = 0, mouth = 0, timers = [];
    function draw() { if (id) drawFace(canvas, id, blink, mouth); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function scheduleBlink() {
      later(function () {
        [.5, 1, .5, 0].forEach(function (b, i) { later(function () { blink = b; draw(); }, i * 45); });
        scheduleBlink();
      }, 2200 + Math.random() * 3200);
    }
    function speak(track, i, done) {
      if (i >= track.length) { mouth = 0; draw(); if (done) done(); return; }
      var beat = track[i];
      // ease toward the target so the jaw doesn't snap
      mouth = beat[0] === 0 ? 0 : mouth * 0.25 + beat[0] * 0.75;
      draw();
      later(function () { speak(track, i + 1, done); }, beat[1] * (0.9 + Math.random() * 0.2));
    }
    return {
      show: function (faceId, text, done) {
        timers.forEach(clearTimeout); timers = [];
        id = faceId; blink = 0; mouth = 0;
        var img = faceImage(id); faceImage(id, true);
        if (!img.complete) img.onload = draw;
        draw();
        if (reduceMotion) return;
        later(function () { speak(speechTrack(text || ''), 0, done); }, 350);
        scheduleBlink();
      }
    };
  }
  var recStack = document.getElementById('recStack');
  if (recStack) {
    var RECS = [
      { text: 'A rare superpower: he creates clarity from chaos — consistently helping teams find focus in ambiguity, painting a compelling vision that connects business goals to meaningful user outcomes.', role: 'Former Direct Report · Product Design Leader', face: 'p1' },
      { text: 'A unique way of bridging the gap between product and design. Openness to new ideas, humility, and a genuine sense of curiosity — teams naturally gravitate to him for guidance.', role: 'Principal Product Manager', face: 'p2' },
      { text: 'The thoughtfulness and rigour with which he approaches problem solving is inspiring — a real ability to analyze, synthesize and reframe complex problems.', role: 'Senior Product Designer', face: 'p8' },
      { text: 'One of the most visionary and empowering design leaders I have ever worked with — deeply versed in product craft and always pointed at where the industry is heading.', role: 'Product Design Lead · Former Report', face: 'p7' },
      { text: 'A kind, compassionate leader with a true gift for operations — with him, your trains will all arrive on time, every time.', role: 'Former Manager · VP, Experience', face: 'p5' },
      { text: 'An oasis of calm in a desert of chaos — and the rare designer who can hold both the system and the soul of a product at once.', role: 'Product Colleague', face: 'p3' },
      { text: 'His team always asks the important product questions, never avoids the difficult ones, and benefits from immense psychological safety.', role: 'Senior HR Business Partner', face: 'p6' }
    ];
    var face = talkingFace(document.getElementById('recFace'));
    var recText = document.getElementById('recText');
    var recAttr = document.getElementById('recAttr');
    var recDots = document.getElementById('recDots');
    var recIdx = 0, recTimer;

    var renderRecDots = function () {
      recDots.innerHTML = '';
      RECS.forEach(function (_, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rec-dot' + (i === recIdx ? ' is-active' : '');
        btn.setAttribute('aria-label', 'Recommendation ' + (i + 1));
        if (i === recIdx) btn.setAttribute('aria-current', 'true');
        btn.addEventListener('click', function () { goTo(i); });
        recDots.appendChild(btn);
      });
    };
    var showRec = function () {
      var r = RECS[recIdx];
      clearTimeout(recTimer);
      face.show(r.face, r.text, function () {
        recTimer = setTimeout(function () { goTo((recIdx + 1) % RECS.length); }, 2600);
      });
      recText.textContent = '“' + r.text + '”';
      recAttr.textContent = r.role;
    };
    var goTo = function (i) {
      clearTimeout(recTimer);
      recStack.classList.replace('recs-in', 'recs-out');
      setTimeout(function () {
        recIdx = i;
        showRec();
        recStack.classList.replace('recs-out', 'recs-in');
        renderRecDots();
      }, reduceMotion ? 0 : 400);
    };
    showRec();
    renderRecDots();
  }

  // ---- 6. CMS-backed writing lists ----
  // Illustration + pastel per essay (images live in assets/writing/<slug>.jpg).
  // New CMS posts without an entry here render as plain cards.
  var POST_ART = {
    'earned-autonomy': '#8fc4f0',
    'ux-career': '#ecd27a',
    'late-bloomers': '#9fdcb8',
    'email-love-story': '#f19fb0'
  };
  var lists = document.querySelectorAll('[data-posts]');
  if (!lists.length) return;

  fetch('/api/posts')
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (posts) {
      if (!Array.isArray(posts) || !posts.length) return;
      lists.forEach(function (list) {
        var limit = parseInt(list.getAttribute('data-limit'), 10) || posts.length;
        list.innerHTML = posts.slice(0, limit).map(function (p) {
          var meta = [p.date, p.tag, p.read_time].filter(Boolean).map(escHtml).join(' · ');
          var art = POST_ART[p.slug];
          return '<li><a class="post"' + (art ? ' style="--hue: ' + art + '"' : '') + ' href="' + escHtml(p.href) + '">' +
            (art ? '<span class="post-art" aria-hidden="true"><img src="/assets/writing/' + escHtml(p.slug) + '.jpg" alt="" width="720" height="720" loading="lazy"></span>' : '') +
            '<span class="post-body">' +
            '<span class="label">' + meta + '</span>' +
            '<h3>' + escHtml(p.title) + ' <span class="go">&rarr;</span></h3>' +
            (p.excerpt ? '<p class="sum">' + escHtml(p.excerpt) + '</p>' : '') +
            '</span></a></li>';
        }).join('');
      });
    })
    .catch(function () { /* keep the fallback markup */ });
})();
