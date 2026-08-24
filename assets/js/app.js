/* ==========================================================================
   Aethra — UI behaviour
   Every module is guarded by the presence of its own markup, so one bundle
   serves every page.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------ toast */
  var toaster;
  function toast(message, kind) {
    if (!toaster) {
      toaster = document.createElement("div");
      toaster.className = "toaster";
      toaster.setAttribute("role", "status");
      toaster.setAttribute("aria-live", "polite");
      document.body.appendChild(toaster);
    }
    var el = document.createElement("div");
    el.className = "toast toast--" + (kind || "ok");
    el.innerHTML =
      '<svg class="i"><use href="#i-' + (kind === "bad" ? "warn" : "check") + '"></use></svg><span></span>';
    $("span", el).textContent = message;
    toaster.appendChild(el);
    setTimeout(function () {
      el.classList.add("is-out");
      setTimeout(function () { el.remove(); }, 240);
    }, 2600);
  }
  window.toast = toast;

  /* -------------------------------------------------------------------- nav */
  function initNav() {
    var nav = $(".nav");
    if (!nav) return;

    var sheet = $(".nav__sheet", nav);
    var toggle = $(".nav__toggle", nav);
    var links = $$(".nav__link", nav);
    var pill = $(".nav__pill", nav);

    /* sliding indicator */
    function movePill(target) {
      if (!pill || !target) return;
      pill.style.width = target.offsetWidth + "px";
      pill.style.transform = "translateX(" + target.offsetLeft + "px)";
      pill.classList.add("is-on");
    }
    function restPill() {
      var current = links.filter(function (l) { return l.getAttribute("aria-current") === "page"; })[0];
      if (current) movePill(current);
      else if (pill) pill.classList.remove("is-on");
    }
    links.forEach(function (link) {
      link.addEventListener("mouseenter", function () { movePill(link); });
      link.addEventListener("focus", function () { movePill(link); });
    });
    var list = $(".nav__links", nav);
    if (list) {
      list.addEventListener("mouseleave", restPill);
      list.addEventListener("focusout", function (e) {
        if (!list.contains(e.relatedTarget)) restPill();
      });
    }
    restPill();
    requestAnimationFrame(restPill); // again once webfonts have settled the widths
    if (list && "ResizeObserver" in window) new ResizeObserver(restPill).observe(list);
    else window.addEventListener("resize", restPill);

    /* condense + auto-hide */
    var lastY = window.scrollY;
    var ticking = false;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle("is-stuck", y > 24);
      var open = sheet && !sheet.hidden;
      if (!open && y > 320 && y > lastY + 6) nav.classList.add("is-hidden");
      else if (y < lastY - 6 || y < 120) nav.classList.remove("is-hidden");
      lastY = y;
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(onScroll);
      },
      { passive: true }
    );
    onScroll();

    /* mobile sheet */
    if (toggle && sheet) {
      var setOpen = function (open) {
        sheet.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        $("use", toggle).setAttribute("href", open ? "#i-close" : "#i-menu");
        if (open) nav.classList.remove("is-hidden");
      };
      toggle.addEventListener("click", function () { setOpen(sheet.hidden); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !sheet.hidden) { setOpen(false); toggle.focus(); }
      });
      document.addEventListener("click", function (e) {
        if (sheet.hidden) return;
        if (!nav.contains(e.target)) setOpen(false);
      });
      $$("a", sheet).forEach(function (a) {
        a.addEventListener("click", function () { setOpen(false); });
      });
      window.addEventListener("resize", function () {
        if (window.innerWidth > 900 && !sheet.hidden) setOpen(false);
      });
    }
  }

  /* ----------------------------------------------------------------- reveal */
  function initReveal() {
    var nodes = $$("[data-reveal]");
    if (!nodes.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    nodes.forEach(function (n, i) {
      // stagger siblings inside the same group
      var group = n.closest("[data-reveal-group]");
      if (group) {
        var idx = $$("[data-reveal]", group).indexOf(n);
        n.style.setProperty("--reveal-delay", Math.min(idx, 8) * 60 + "ms");
      } else {
        n.style.setProperty("--reveal-delay", Math.min(i, 4) * 40 + "ms");
      }
      io.observe(n);
    });
  }

  /* -------------------------------------------------------------- count-ups */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(el) {
      var to = parseFloat(el.dataset.count);
      var suffix = el.dataset.suffix || "";
      var decimals = parseInt(el.dataset.decimals || "0", 10);
      if (reduced) {
        el.textContent = to.toFixed(decimals) + suffix;
        return;
      }
      var t0 = performance.now();
      var dur = 1100;
      (function step(now) {
        var p = Math.min((now - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    if (!("IntersectionObserver" in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          run(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.4 }
    );
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------------ chart */
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var t = 0.18; // tension — keeps the curve honest, no overshoot spikes
      var c1x = p1[0] + (p2[0] - p0[0]) * t;
      var c1y = p1[1] + (p2[1] - p0[1]) * t;
      var c2x = p2[0] - (p3[0] - p1[0]) * t;
      var c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += "C" + c1x.toFixed(2) + "," + c1y.toFixed(2) +
           " " + c2x.toFixed(2) + "," + c2y.toFixed(2) +
           " " + p2[0].toFixed(2) + "," + p2[1].toFixed(2);
    }
    return d;
  }

  function initCharts() {
    $$(".chart[data-series]").forEach(function (host) {
      var data;
      try { data = JSON.parse(host.dataset.series); } catch (err) { return; }
      var labels = data.labels || [];
      var values = data.values || [];
      if (!values.length) return;

      var narrow = null;
      var render = function () {
        var isNarrow = host.clientWidth < 520;
        if (isNarrow === narrow) return;
        narrow = isNarrow;
        host.innerHTML = "";
        draw(host, labels, values, data.unit || "", isNarrow);
      };
      render();

      // Container-driven, not viewport-driven: the card also changes width when
      // the activity grid collapses to one column.
      var t;
      var schedule = function () {
        clearTimeout(t);
        t = setTimeout(render, 150);
      };
      if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(host);
      else window.addEventListener("resize", schedule);
    });
  }

  // A wide viewBox squashes to a letterbox strip on phones, so the compact
  // layout gets its own aspect ratio rather than a scaled-down copy.
  function draw(host, labels, values, unit, narrow) {
      var W = narrow ? 400 : 660;
      var H = narrow ? 280 : 240;
      var padL = 34, padR = 12, padT = 16, padB = 28;
      var innerW = W - padL - padR;
      var innerH = H - padT - padB;

      var max = Math.max.apply(null, values);
      var min = Math.min.apply(null, values);
      var top = Math.ceil(max * 1.12);
      var bottom = Math.max(0, Math.floor(min * 0.72));
      var span = top - bottom || 1;

      var x = function (i) { return padL + (innerW * i) / Math.max(values.length - 1, 1); };
      var y = function (v) { return padT + innerH - ((v - bottom) / span) * innerH; };

      var pts = values.map(function (v, i) { return [x(i), y(v)]; });
      var line = smoothPath(pts);
      var area = line + "L" + x(values.length - 1).toFixed(2) + "," + (padT + innerH) +
                 "L" + padL + "," + (padT + innerH) + "Z";

      var ticks = 4;
      var grid = "";
      var yAxis = "";
      for (var t = 0; t <= ticks; t++) {
        var vy = padT + (innerH * t) / ticks;
        grid += '<line x1="' + padL + '" y1="' + vy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + vy.toFixed(1) + '"/>';
        var val = Math.round(top - (span * t) / ticks);
        yAxis += '<text class="chart__axis" x="' + (padL - 8) + '" y="' + (vy + 3.5).toFixed(1) + '" text-anchor="end">' + val + "</text>";
      }

      var xAxis = labels
        .map(function (l, i) {
          if (labels.length > 8 && i % 2 !== 0) return "";
          return '<text class="chart__axis" x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + l + "</text>";
        })
        .join("");

      var colW = innerW / Math.max(values.length - 1, 1);
      var cols = values
        .map(function (v, i) {
          var cx = x(i);
          return (
            '<g class="chart__col" tabindex="0" role="img" aria-label="' +
            (labels[i] || i) + ": " + v + '">' +
            '<rect class="chart__hover" x="' + (cx - colW / 2).toFixed(1) + '" y="' + padT + '" width="' + colW.toFixed(1) + '" height="' + innerH + '" rx="4"/>' +
            '<circle class="chart__dot" cx="' + cx.toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" opacity="0"/>' +
            "</g>"
          );
        })
        .join("");

      host.insertAdjacentHTML(
        "afterbegin",
        '<svg viewBox="0 0 ' + W + " " + H + '" role="presentation">' +
          '<defs><linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#dfe6f0" stop-opacity="0.22"/>' +
          '<stop offset="100%" stop-color="#dfe6f0" stop-opacity="0"/>' +
          "</linearGradient></defs>" +
          '<g class="chart__grid">' + grid + "</g>" +
          yAxis +
          '<path class="chart__area" d="' + area + '"/>' +
          '<path class="chart__line" d="' + line + '"/>' +
          xAxis +
          cols +
          "</svg>"
      );

      var svg = $("svg", host);
      var lineEl = $(".chart__line", host);
      if (lineEl && !reduced) {
        var len = lineEl.getTotalLength();
        lineEl.style.strokeDasharray = len;
        lineEl.style.strokeDashoffset = len;
        lineEl.getBoundingClientRect();
        lineEl.style.transition = "stroke-dashoffset 1400ms cubic-bezier(0.16,1,0.3,1)";
        lineEl.style.strokeDashoffset = "0";
      }

      var tip = document.createElement("div");
      tip.className = "chart-tip";
      tip.innerHTML = "<strong></strong><span></span>";
      host.appendChild(tip);

      function show(i, el) {
        $("strong", tip).textContent = values[i] + unit;
        $("span", tip).textContent = labels[i] || "";
        var dot = $(".chart__dot", el);
        if (dot) dot.setAttribute("opacity", "1");
        var box = host.getBoundingClientRect();
        var svgBox = svg.getBoundingClientRect();
        var px = ((x(i) / W) * svgBox.width) + (svgBox.left - box.left);
        var py = ((y(values[i]) / H) * svgBox.height) + (svgBox.top - box.top);
        tip.style.left = px + "px";
        tip.style.top = py + "px";
        tip.classList.add("is-on");
      }
      function hide(el) {
        var dot = $(".chart__dot", el);
        if (dot) dot.setAttribute("opacity", "0");
        tip.classList.remove("is-on");
      }
      $$(".chart__col", host).forEach(function (col, i) {
        col.addEventListener("mouseenter", function () { show(i, col); });
        col.addEventListener("focus", function () { show(i, col); });
        col.addEventListener("mouseleave", function () { hide(col); });
        col.addEventListener("blur", function () { hide(col); });
      });
  }

  /* ------------------------------------------------------------------- bars */
  function initBars() {
    var bars = $$(".bar__fill[data-value]");
    if (!bars.length) return;
    var apply = function (b) { b.style.setProperty("--v", b.dataset.value + "%"); };
    if (reduced || !("IntersectionObserver" in window)) { bars.forEach(apply); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        apply(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    bars.forEach(function (b) { io.observe(b); });
  }

  /* -------------------------------------------------------------- scrollspy */
  function initScrollspy() {
    var links = $$(".toc__link");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    var targets = links
      .map(function (l) {
        var id = l.getAttribute("href").slice(1);
        var el = document.getElementById(id);
        if (el) map[id] = l;
        return el;
      })
      .filter(Boolean);

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.classList.remove("is-active"); });
          var active = map[e.target.id];
          if (active) active.classList.add("is-active");
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ------------------------------------------------------------------- tabs */
  function initTabs() {
    var tablist = $("[data-tabs]");
    if (!tablist) return;
    var tabs = $$('[role="tab"]', tablist);
    if (!tabs.length) return;

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      var id = tab.getAttribute("aria-controls");
      if (id && history.replaceState) history.replaceState(null, "", "#" + id);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        select(tab);
      });
      tab.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(tab);
        var next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, true);
      });
    });

    var hash = location.hash.slice(1);
    var initial = tabs.filter(function (t) { return t.getAttribute("aria-controls") === hash; })[0];
    select(initial || tabs[0]);
  }

  /* ------------------------------------------------------------------- copy */
  function initCopy() {
    $$("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = btn.dataset.copy;
        var done = function () { toast("Скопировано в буфер обмена"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { toast("Не удалось скопировать", "bad"); });
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); done(); } catch (e) { toast("Не удалось скопировать", "bad"); }
          ta.remove();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ forms */
  var RULES = {
    login: function (v) {
      if (v.length < 3) return "Минимум 3 символа";
      if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return "Только латиница, цифры и _ . -";
      return "";
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Введите корректный e-mail";
    },
    password: function (v) {
      return v.length >= 8 ? "" : "Минимум 8 символов";
    },
    required: function (v) {
      return v.trim() ? "" : "Заполните поле";
    }
  };

  function validateField(input) {
    var field = input.closest(".field");
    if (!field) return true;
    var rule = RULES[input.dataset.rule] || RULES.required;
    var msg = rule(input.value);

    if (!msg && input.dataset.match) {
      var other = document.getElementById(input.dataset.match);
      if (other && other.value !== input.value) msg = "Пароли не совпадают";
    }

    var out = $(".field__error", field);
    if (out) out.textContent = msg;
    field.classList.toggle("is-invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }

  function initForms() {
    $$("form[data-validate]").forEach(function (form) {
      if (form.hasAttribute("data-auth")) return;
      var inputs = $$("input[data-rule]", form);

      inputs.forEach(function (input) {
        // validate on blur first, then live once the field is known-bad
        input.addEventListener("blur", function () { validateField(input); });
        input.addEventListener("input", function () {
          if (input.closest(".field").classList.contains("is-invalid")) validateField(input);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;
        inputs.forEach(function (i) { if (!validateField(i)) ok = false; });
        if (!ok) {
          var bad = $(".field.is-invalid input", form);
          if (bad) bad.focus();
          return;
        }
        var btn = $('button[type="submit"]', form);
        if (btn) {
          btn.setAttribute("aria-disabled", "true");
          var label = btn.textContent;
          btn.textContent = "Проверяем…";
          setTimeout(function () {
            btn.removeAttribute("aria-disabled");
            btn.textContent = label;
            toast(form.dataset.success || "Готово");
            if (form.dataset.reset === "true") form.reset();
          }, 900);
        } else {
          toast(form.dataset.success || "Готово");
        }
      });
    });

    /* password strength meter */
    $$("[data-strength]").forEach(function (input) {
      var meter = document.getElementById(input.dataset.strength);
      if (!meter) return;
      var segs = $$(".strength__seg", meter);
      input.addEventListener("input", function () {
        var v = input.value;
        var score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v) && v.length >= 12) score++;
        var level = v.length === 0 ? 0 : Math.min(score, 3) || 1;
        segs.forEach(function (s, i) {
          s.className = "strength__seg" + (i < (level === 3 ? 3 : level) ? " is-on-" + level : "");
        });
      });
    });

    /* reveal-password toggles */
    $$("[data-toggle-pw]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.dataset.togglePw);
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
        btn.setAttribute("aria-pressed", String(show));
      });
    });
  }

  /* ------------------------------------------------------------------- chat */
  function initChat() {
    var chat = $("[data-chat]");
    if (!chat) return;
    var log = $(".chat__log", chat);
    var form = $(".chat__form", chat);
    var input = $("input", form);

    var seed = [
      { a: "Ril1k", t: "12:04", m: "Кто-нибудь пробовал новую сборку на FunTime?" },
      { a: "782", t: "12:06", m: "Да, полёт нормальный. Профиль legit не трогал." },
      { a: "n0va", t: "12:09", m: "HWID привязался с первого раза, без ребута." }
    ];

    // simulate the network round-trip the skeletons stand in for
    setTimeout(function () {
      log.innerHTML = "";
      seed.forEach(function (m) { append(m.a, m.t, m.m); });
      log.scrollTop = log.scrollHeight;
    }, 700);

    function append(author, time, body) {
      var el = document.createElement("div");
      el.className = "chat__msg";
      el.innerHTML =
        '<div class="avatar"></div><div><div class="chat__author"></div><div class="chat__body"></div></div>';
      $(".avatar", el).textContent = author.slice(0, 2).toUpperCase();
      $(".chat__author", el).innerHTML = "<span></span>";
      $(".chat__author", el).insertBefore(document.createTextNode(author), $(".chat__author span", el));
      $(".chat__author span", el).textContent = time;
      $(".chat__body", el).textContent = body;
      log.appendChild(el);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      var now = new Date();
      append("awdawd", ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2), text);
      log.scrollTop = log.scrollHeight;
      input.value = "";
    });
  }

  /* ------------------------------------------------------------------- misc */
  function initMisc() {
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // single-open FAQ
    var faq = $(".faq");
    if (faq) {
      $$("details", faq).forEach(function (d) {
        d.addEventListener("toggle", function () {
          if (!d.open) return;
          $$("details", faq).forEach(function (o) { if (o !== d) o.open = false; });
        });
      });
    }
  }

  /* ------------------------------------------------------------------- boot */
  function boot() {
    initNav();
    initReveal();
    initCounters();
    initCharts();
    initBars();
    initScrollspy();
    initTabs();
    initCopy();
    initForms();
    initChat();
    initMisc();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
