// Kiley Meehan — Portfolio
// Two small enhancements, nothing heavier:
//   1. Scroll-spy: highlight the toc link for the section in view.
//   2. Reveal: gentle fade-up on scroll (skipped for reduced motion;
//      the .js class gates the CSS so content is never hidden without JS).

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  // ---- 1. Scroll-spy nav highlighting ----
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc-link'));
  var sections = links
    .map(function (link) {
      var id = link.getAttribute('href').slice(1);
      return document.getElementById(id);
    })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      // A horizontal band around the upper-middle of the viewport:
      // whichever section occupies it is "current".
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach(function (section) { spy.observe(section); });
  }

  // ---- 2. Fade-in reveals ----
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var revealer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );

  reveals.forEach(function (el) { revealer.observe(el); });

  // ---- 3. Recommendations carousel (index page only) ----
  var recStack = document.getElementById('recStack');
  if (!recStack) return;

  var RECS = [
    { text: 'A rare superpower: he creates clarity from chaos — consistently helping teams find focus in ambiguity, painting a compelling vision that connects business goals to meaningful user outcomes.', role: 'Former Direct Report · Product Design Leader', face: 'assets/face1.png' },
    { text: 'A unique way of bridging the gap between product and design. Openness to new ideas, humility, and a genuine sense of curiosity — teams naturally gravitate to him for guidance.', role: 'Principal Product Manager', face: 'assets/face2.png' },
    { text: 'The thoughtfulness and rigour with which he approaches problem solving is inspiring — a real ability to analyze, synthesize and reframe complex problems.', role: 'Senior Product Designer', face: 'assets/face5.png' },
    { text: 'One of the most visionary and empowering design leaders I have ever worked with — deeply versed in product craft and always pointed at where the industry is heading.', role: 'Product Design Lead · Former Report', face: 'assets/face6.png' },
    { text: 'A kind, compassionate leader with a true gift for operations — with him, your trains will all arrive on time, every time.', role: 'Former Manager · VP, Experience', face: 'assets/face8.png' },
    { text: 'An oasis of calm in a desert of chaos — and the rare designer who can hold both the system and the soul of a product at once.', role: 'Product Colleague', face: 'assets/face3.png' },
    { text: 'His team always asks the important product questions, never avoids the difficult ones, and benefits from immense psychological safety.', role: 'Senior HR Business Partner', face: 'assets/face7.png' }
  ];

  var recFace = document.getElementById('recFace');
  var recText = document.getElementById('recText');
  var recAttr = document.getElementById('recAttr');
  var recDots = document.getElementById('recDots');
  var recIdx = 0;
  var recTimer;

  function renderRecDots() {
    recDots.innerHTML = '';
    RECS.forEach(function (_, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rec-dot' + (i === recIdx ? ' is-active' : '');
      btn.setAttribute('aria-label', 'Recommendation ' + (i + 1));
      btn.addEventListener('click', function () { jumpToRec(i); });
      recDots.appendChild(btn);
    });
  }

  function showRec() {
    var r = RECS[recIdx];
    recFace.style.webkitMaskImage = 'url(' + r.face + ')';
    recFace.style.maskImage = 'url(' + r.face + ')';
    recText.textContent = '“' + r.text + '”';
    recAttr.textContent = r.role;
  }

  function jumpToRec(i) {
    clearInterval(recTimer);
    recStack.classList.replace('recs-in', 'recs-out');
    setTimeout(function () {
      recIdx = i;
      showRec();
      recStack.classList.replace('recs-out', 'recs-in');
      renderRecDots();
    }, reduceMotion ? 0 : 280);
    startRecTimer();
  }

  function advanceRec() {
    recStack.classList.replace('recs-in', 'recs-out');
    setTimeout(function () {
      recIdx = (recIdx + 1) % RECS.length;
      showRec();
      recStack.classList.replace('recs-out', 'recs-in');
      renderRecDots();
    }, reduceMotion ? 0 : 450);
  }

  function startRecTimer() {
    clearInterval(recTimer);
    if (!reduceMotion) recTimer = setInterval(advanceRec, 7500);
  }

  showRec();
  renderRecDots();
  startRecTimer();
})();
