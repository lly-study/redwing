/* ============================================================
   红色文化志愿行 · 交互脚本
   功能：页脚年份、移动端菜单、返回顶部、相册大图查看(Lightbox)、
        视频缺失时给出提示
   ============================================================ */
(function () {
  'use strict';

  /* ---- 页脚年份 ---- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- 移动端菜单 ---- */
  var nav = document.getElementById('site-nav');
  var menuBtn = document.getElementById('menu-btn');
  if (nav && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.classList.toggle('on', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('lock', open);
    });
    /* 点完菜单项后收起（手机端） */
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        menuBtn.classList.remove('on');
        document.body.classList.remove('lock');
      }
    });
  }

  /* ---- 返回顶部 ---- */
  var toTop = document.getElementById('to-top');
  if (toTop) {
    var onScroll = function () {
      toTop.classList.toggle('show', window.scrollY > 480);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- 相册大图查看（Lightbox）----
     页面上所有带 class="g-item" 的图片会自动加入看图功能，
     支持左右键切换、Esc 关闭。 */
  var items = Array.prototype.slice.call(document.querySelectorAll('img.g-item'));
  if (items.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="lb-close" type="button" aria-label="关闭大图">✕</button>' +
      '<button class="lb-nav lb-prev" type="button" aria-label="上一张">‹</button>' +
      '<div class="lb-stage">' +
      '<img alt="" />' +
      '<p class="lb-cap"></p>' +
      '</div>' +
      '<button class="lb-nav lb-next" type="button" aria-label="下一张">›</button>';
    document.body.appendChild(lb);

    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('.lb-cap');
    var idx = 0;

    function show(i) {
      if (i < 0) i = items.length - 1;
      if (i >= items.length) i = 0;
      idx = i;
      var it = items[idx];
      lbImg.src = it.currentSrc || it.src;
      lbImg.alt = it.alt || '';
      lbCap.textContent = it.alt || '';
      document.body.classList.add('lock');
      lb.classList.add('open');
    }
    function close() {
      lb.classList.remove('open');
      document.body.classList.remove('lock');
    }

    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });

    items.forEach(function (im, i) {
      im.addEventListener('click', function () { show(i); });
    });
  }

  /* ---- 视频缺失提示 ----
     若视频文件还没放进去，浏览器会触发 error，
     此时隐藏播放器并显示「如何添加视频」的提示。 */
  Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
    var box = v.closest('.video-box');
    var tip = box ? box.querySelector('.video-tip') : null;
    if (!tip) return;
    v.addEventListener('error', function () {
      if (!v.currentSrc && !v.src) return;
      tip.hidden = false;
      v.style.display = 'none';
    });
  });
})();

/* ============================================================
   滚动浮现动画：页面往下滚时，各模块的标题/文字/配图缓缓向上浮现
   ============================================================ */
(function () {
  'use strict';

  /* 不支持 IntersectionObserver 的旧浏览器：取消隐藏，内容直接可见 */
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('js');
    return;
  }

  var selector =
    '.section-head, .split > *, .cards .card, .gallery-grid figure, ' +
    '.chipbar, .album-head, .album-desc, .video-box, .notice, ' +
    '.cta .container, .page-hero h1, .entry-card, .mentor-card, ' +
    '.feel-card, .skill-head, .sub-head, .step, .callout-warning, ' +
    '.mistake-list li, .poster, .vs';

  var els = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!els.length) { document.documentElement.classList.remove('js'); return; }

  els.forEach(function (el) { el.classList.add('reveal'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);   /* 浮现一次即可，不再重复监听 */
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(function (el) { io.observe(el); });
})();

/* ============================================================
   首页首屏照片轮播（6 屏 · 缓慢放大"呼吸感"）
   性能设计（改动时请保留，否则首屏会重新卡顿）：
     1) 图片懒加载：只有"当前"与"下一张"会真正请求并解码；
     2) "呼吸感"缩放动画只加在内层 .slide-img 上，并且只有当前活动的那张开 will-change；
     3) 页面切到后台、或首屏滚出视口时暂停；
     4) 图片加载失败的屏会被自动跳过并移除，不出现空白屏。
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('hero-slider');
  if (!root) return;

  var INTERVAL = 7000;   /* 与 CSS 里呼吸动画的时长（7s）保持一致，一屏走完一个呼吸周期 */
  var dotsWrap = root.querySelector('.hero-dots');
  var prevBtn = root.querySelector('.hero-btn.prev');
  var nextBtn = root.querySelector('.hero-btn.next');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
  var dots = [];
  var cur = 0, timer = null, visible = true;

  /* ---------- 加载某屏的图片；成功回调 true ---------- */
  function ensure(i, cb) {
    var s = slides[i];
    var img = s ? s.querySelector('.slide-img') : null;
    if (!s || !img) { cb(false); return; }
    if (img.dataset.ready === '1') { cb(true); return; }
    var src = img.getAttribute('data-src') || img.getAttribute('src');
    if (!src) { cb(false); return; }
    var pre = new Image();
    pre.onload = function () { img.src = src; img.dataset.ready = '1'; cb(true); };
    pre.onerror = function () { cb(false); };
    pre.src = src;
  }

  /* ---------- 移除不可用的屏（含圆点），并修正游标 ---------- */
  function dropSlide(i) {
    var s = slides[i];
    if (!s) return;
    if (s.parentNode) { s.parentNode.removeChild(s); }
    if (dots[i] && dots[i].parentNode) { dots[i].parentNode.removeChild(dots[i]); }
    slides.splice(i, 1);
    dots.splice(i, 1);
    if (cur > i) { cur -= 1; }
    if (cur >= slides.length) { cur = 0; }
    labelDots();
  }
  function labelDots() {
    dots.forEach(function (d, i) { d.setAttribute('aria-label', '第 ' + (i + 1) + ' 张'); });
  }

  /* ---------- 控制条 ---------- */
  function removeControls() {
    if (dotsWrap && dotsWrap.parentNode) { dotsWrap.parentNode.removeChild(dotsWrap); }
    if (prevBtn && prevBtn.parentNode) { prevBtn.parentNode.removeChild(prevBtn); }
    if (nextBtn && nextBtn.parentNode) { nextBtn.parentNode.removeChild(nextBtn); }
  }
  function showOnly(i) {
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
  }
  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    dots = slides.map(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.addEventListener('click', function () { show(i); restart(); });
      dotsWrap.appendChild(d);
      return d;
    });
    labelDots();
  }

  /* ---------- 渲染 ---------- */
  function paint() {
    slides.forEach(function (s, i) {
      var on = (i === cur);
      s.classList.toggle('is-active', on);
      /* 奇偶交替：一屏缓慢放大、一屏缓慢缩小，观感更自然 */
      s.classList.toggle('zoom-out', on && (i % 2 === 1));
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); });
  }

  /* ---------- 播放控制 ---------- */
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() {
    if (timer || document.hidden || !visible || slides.length < 2) return;
    timer = setInterval(function () { step(1); }, INTERVAL);
  }
  function restart() { stop(); start(); }
  function finish() {                    /* 只剩 0/1 屏：收工 */
    stop();
    if (slides.length === 0) { removeControls(); return; }
    cur = 0;
    showOnly(0);
    removeControls();
  }

  /* ---------- 切换：逐张尝试，失败的屏直接剔除 ---------- */
  function step(dir) {
    var n = slides.length;
    if (n < 2) { finish(); return; }
    var tries = 0;
    (function attempt(from) {
      if (tries >= n) { finish(); return; }
      tries++;
      var next = ((from + dir) % slides.length + slides.length) % slides.length;
      ensure(next, function (ok) {
        if (ok) {
          cur = next;
          paint();
          ensure(((cur + 1) % slides.length), function () {});   /* 预取下一张 */
          return;
        }
        dropSlide(next);
        if (slides.length < 2) { finish(); return; }
        attempt(cur);
      });
    })(cur);
  }

  /* 点圆点跳转 */
  function show(i) {
    ensure(i, function (ok) {
      if (!ok) { dropSlide(i); if (slides.length < 2) { finish(); } return; }
      cur = i;
      paint();
    });
  }

  /* ---------- 初始化 ---------- */
  if (!slides.length) { removeControls(); return; }

  ensure(0, function (ok) {
    if (!ok) {
      dropSlide(0);
      if (slides.length < 2) { finish(); return; }
      /* 第一屏不可用时，从新的第一屏重新开始 */
      ensure(0, function (ok2) {
        if (!ok2) { finish(); return; }
        buildDots(); paint(); start();
      });
      return;
    }
    if (slides.length < 2) { finish(); return; }
    buildDots();
    paint();
    ensure(1, function () {});           /* 预取下一张 */
    start();
  });

  /* ---------- 交互 ---------- */
  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); restart(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(1); restart(); });

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', restart);

  /* 手机左右滑动切换 */
  var x0 = null;
  root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { step(dx < 0 ? 1 : -1); restart(); }
  }, { passive: true });

  /* 首屏滚出视口时暂停 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { start(); } else { stop(); }
    }, { threshold: 0.05 }).observe(root);
  }
  /* 切到后台标签页时暂停 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { start(); }
  });
})();

/* ============================================================
   左侧模块导航（桌面宽屏 · 灵动红星 · 六页通用）
   · 按页面配置模块清单（id 锚点 + 名称），自动生成左侧导航；
   · 滚动时用「金边五角红星」沿轨道弹簧滑动到当前模块并高亮；
   · 只在宽屏（≥1400px）显示，窄屏/移动端隐藏，避免挤压正文。
   · 扩展新页面：在下面 RAIL 里补上对应页面名与模块清单即可（顺序即页面从上到下的顺序）。
   ============================================================ */
(function () {
  'use strict';

  var RAIL = {
    'index.html': [
      { id: 'about',    label: '关于我们' },
      { id: 'features', label: '我们的活动' },
      { id: 'modules',  label: '更多内容' }
    ],
    'about.html': [
      { id: 'background', label: '项目背景' },
      { id: 'policy',     label: '政策支持' },
      { id: 'innovation', label: '核心创新' },
      { id: 'edge',       label: '核心优势' },
      { id: 'howto',      label: '实施路径' },
      { id: 'value',      label: '成果与价值' },
      { id: 'plan',       label: '未来规划' }
    ],
    'team.html': [
      { id: 'mentors',    label: '导师阵容' },
      { id: 'org',        label: '组织架构' },
      { id: 'volunteers', label: '志愿风采' }
    ],
    'activities.html': [
      { id: 'album-1', label: '红色寻访' },
      { id: 'album-2', label: '入户调研' },
      { id: 'album-3', label: '试点宣讲' },
      { id: 'videos',  label: '精彩视频' }
    ],
    'resources.html': [
      { id: 'cpr',      label: '心肺复苏' },
      { id: 'choking',  label: '海姆立克' },
      { id: 'bleeding', label: '包扎止血' },
      { id: 'aviation', label: '航空专栏' }
    ],
    'join.html': [
      { id: 'roles',   label: '招募方向' },
      { id: 'contact', label: '联系方式' }
    ]
  };

  var page = location.pathname.split('/').pop() || 'index.html';
  var defs = RAIL[page];
  if (!defs || defs.length < 2) return;

  var entries = defs.filter(function (d) {
    var el = document.getElementById(d.id);
    if (el) { d.el = el; return true; }
    return false;
  });
  if (entries.length < 2) return;

  /* ---- 构建导航 DOM ---- */
  var rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', '本页模块导航');

  var track = document.createElement('div');
  track.className = 'rail-track';
  track.setAttribute('aria-hidden', 'true');
  rail.appendChild(track);

  var marker = document.createElement('span');
  marker.className = 'rail-marker';
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
    '<polygon class="rail-star" points="12 2, 14.6 8.6, 21.5 9.2, 16.2 13.9, 17.8 20.7, 12 17.2, 6.2 20.7, 7.8 13.9, 2.5 9.2, 9.4 8.6"></polygon>' +
    '</svg>';
  rail.appendChild(marker);

  entries.forEach(function (d) {
    var a = document.createElement('a');
    a.className = 'rail-item';
    a.href = '#' + d.id;
    var dot = document.createElement('span');
    dot.className = 'rail-dot';
    var lab = document.createElement('span');
    lab.className = 'rail-label';
    lab.textContent = d.label;
    a.appendChild(dot);
    a.appendChild(lab);
    rail.appendChild(a);
    d.item = a;
    d.dot = dot;
  });

  document.body.appendChild(rail);

  /* ---- 激活态与标记定位 ---- */
  var active = null;
  var mq = window.matchMedia('(min-width: 1400px)');

  /* 目标圆点中心相对导航顶部的偏移；红星标记 top:8px，故末尾 -8 对齐 */
  function dotY(d) {
    return d.dot.getBoundingClientRect().top - rail.getBoundingClientRect().top +
           d.dot.offsetHeight / 2 - 8;
  }

  function setActive(d) {
    if (d === active) return;
    active = d;
    entries.forEach(function (e) { e.item.classList.toggle('on', e === d); });
    if (d) {
      rail.style.setProperty('--rail-y', dotY(d).toFixed(1) + 'px');
      rail.classList.add('on');
    } else {
      rail.classList.remove('on');
    }
  }

  /* ---- 滚动检测：取「上边缘已越过视口 40% 线」的最末一个模块 ---- */
  var ticking = false;
  function update() {
    ticking = false;
    if (!mq.matches) return;
    var line = window.innerHeight * 0.4;
    var cur = null;
    entries.forEach(function (d) {
      if (d.el.getBoundingClientRect().top <= line) cur = d;
    });
    /* 滚到页底时，最后一个模块强制激活（避免短模块无法触发） */
    var scrolled = window.innerHeight + window.scrollY;
    var bottom = document.documentElement.scrollHeight;
    if (scrolled >= bottom - 2) cur = entries[entries.length - 1];
    setActive(cur);
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('load', update);
  update();
})();
