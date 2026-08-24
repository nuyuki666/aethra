/* ==========================================================================
   Aethra — auth & account behaviour (login / register / profile pages)
   ========================================================================== */
(function () {
  "use strict";

  var S = window.AethraStore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var PAY = {
    tg: "https://t.me/aethra_support",
    funpay: "",
    yookassa: "",
    skinback: ""
  };
  var PLAN_INFO = {
    week: { name: "Неделя", price: "100 ₽", term: "7 дней" },
    month: { name: "Месяц", price: "300 ₽", term: "30 дней" },
    life: { name: "Навсегда", price: "450 ₽", term: "бессрочно" }
  };
  var METHODS = [
    { id: "funpay", name: "FunPay", desc: "Карта · СБП · баланс площадки", link: PAY.funpay },
    { id: "yookassa", name: "ЮKassa", desc: "МИР · Visa · Mastercard · СБП", link: PAY.yookassa },
    { id: "skinback", name: "SkinBack", desc: "Оплата скинами из Steam", link: PAY.skinback }
  ];

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

  function fieldError(input, msg) {
    var field = input.closest(".field");
    if (!field) return;
    var out = $(".field__error", field);
    if (out) out.textContent = msg;
    field.classList.toggle("is-invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function validate(input) {
    var rule = RULES[input.dataset.rule] || RULES.required;
    var msg = rule(input.value);
    if (!msg && input.dataset.match) {
      var other = document.getElementById(input.dataset.match);
      if (other && other.value !== input.value) msg = "Пароли не совпадают";
    }
    fieldError(input, msg);
    return !msg;
  }

  function busy(form, on, label) {
    var btn = $('button[type="submit"]', form);
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.setAttribute("aria-disabled", "true");
      btn.textContent = label || "Проверяем…";
    } else {
      btn.removeAttribute("aria-disabled");
      btn.textContent = btn.dataset.label || btn.textContent;
    }
  }

  /* ------------------------------------------ баннер недоступности (VPN) */
  function showOfflineBanner() {
    if ($("[data-offline-banner]")) return;
    var b = document.createElement("div");
    b.className = "offline-banner";
    b.setAttribute("data-offline-banner", "");
    b.innerHTML =
      '<svg class="i"><use href="#i-warn"></use></svg>' +
      "<div><b>Сервер недоступен.</b> Если включен VPN или прокси-расширение " +
      "(Юбуст VPN и похожие) — отключите их для этого сайта и обновите страницу.</div>" +
      '<button class="btn btn--primary btn--sm" type="button" data-offline-reload>Обновить</button>' +
      '<button class="btn btn--quiet btn--sm" type="button" data-offline-close aria-label="Скрыть">✕</button>';
    document.body.appendChild(b);
    $("[data-offline-reload]", b).addEventListener("click", function () { location.reload(); });
    $("[data-offline-close]", b).addEventListener("click", function () { b.remove(); });
  }

  /* ------------------------------------------------------------------- nav */
  function injectAdminLink(me) {
    if (!me || me.role !== "admin") return;
    if ($('a[href="admin.html"]')) return;
    var links = $(".nav__links");
    if (links) {
      var li = document.createElement("li");
      li.innerHTML =
        '<a class="nav__link" href="admin.html"><svg class="i"><use href="#i-shield"></use></svg>Админка</a>';
      links.appendChild(li);
    }
    var sheet = $(".nav__sheet");
    if (sheet) {
      var a = document.createElement("a");
      a.className = "nav__sheet-link";
      a.href = "admin.html";
      a.innerHTML = '<svg class="i"><use href="#i-shield"></use></svg>Админка';
      sheet.insertBefore(a, $(".nav__sheet-actions"));
    }
  }

  /* --------------------------------------------------------------- profile */
  function subState(u) {
    if (u.banned) return { code: "banned", label: "Заблокирован" };
    if (u.lifetime) return { code: "life", label: "Активна · навсегда" };
    if (u.subUntil > Date.now()) return { code: "ok", label: "Активна" };
    if (u.subUntil) return { code: "expired", label: "Истекла" };
    return { code: "none", label: "Неактивна" };
  }

  function hydrateProfile(me) {
    $$("[data-user-avatar]").forEach(function (el) {
      if (me.avatar) {
        el.innerHTML = '<img src="' + me.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      } else {
        el.textContent = me.login.slice(0, 2).toUpperCase();
      }
    });
    $$("[data-user-name]").forEach(function (el) { el.textContent = me.login; });
    $$("[data-user-meta]").forEach(function (el) {
      el.textContent = "Роль: " + (me.role === "admin" ? "Admin" : "Default") + " · ID " + me.id;
    });

    var role = me.role === "admin" ? "Admin" : "Default";
    var kv = {
      id: String(me.id),
      role: role,
      login: me.login,
      email: me.email,
      reg: S.fmtDateTime(me.regAt),
      last: me.lastLogin ? S.fmtDateTime(me.lastLogin) : "—"
    };
    Object.keys(kv).forEach(function (k) {
      $$('[data-kv="' + k + '"]').forEach(function (el) { el.textContent = kv[k]; });
    });

    var st = subState(me);
    var until = me.lifetime ? "бессрочно" : (me.subUntil ? S.fmtDateTime(me.subUntil) : null);

    $$("[data-sub-badge]").forEach(function (el) {
      el.className = "badge" + (
        st.code === "ok" || st.code === "life" ? " badge--ok" :
        st.code === "banned" || st.code === "expired" ? " badge--bad" : " badge--warn"
      );
      el.innerHTML = '<svg class="i"><use href="#' +
        (st.code === "banned" ? "i-warn" : st.code === "none" ? "i-clock" : "i-check") +
        '"></use></svg> ' + st.label;
    });

    $$("[data-sub-title]").forEach(function (el) {
      el.textContent = st.code === "life" ? "Пожизненный доступ" :
        st.code === "ok" ? "Подписка активна" :
        st.code === "expired" ? "Подписка истекла" :
        st.code === "banned" ? "Аккаунт заблокирован" : "Нет активной подписки";
    });

    $$("[data-sub-note]").forEach(function (el) {
      el.textContent = st.code === "life" ? "Доступ без ограничений по сроку." :
        st.code === "ok" ? "Действует до " + until + "." :
        st.code === "expired" ? "Истекла " + until + ". Активируйте новый ключ." :
        st.code === "banned" ? "Доступ ограничен администратором." :
        "Активируйте ключ — отсчёт начнётся с этого момента.";
    });

    var hist = $("[data-history]");
    if (hist) {
      if (!me.history || !me.history.length) {
        hist.innerHTML =
          '<div class="empty"><svg class="i"><use href="#i-inbox"></use></svg>' +
          "<p>Покупок пока нет. После активации ключа здесь появятся дата и тариф.</p></div>";
      } else {
        hist.innerHTML = '<ul class="server-list">' + me.history.map(function (h) {
          return '<li class="server"><span class="server__logo">AE</span><div>' +
            '<div class="server__name">' + h.label + "</div>" +
            '<div class="server__meta">' + S.fmtDateTime(h.at) + "</div></div></li>";
        }).join("") + "</ul>";
      }
    }
  }

  /* ------------------------------------------------------------- redirects */
  async function handleGuards() {
    var page = document.body.dataset.authPage;

    if (page === "login" || page === "register" || page === "profile") {
      var me0 = await S.current();

      if (me0 && me0.banned) {
        await S.logout();
        location.replace("login.html?msg=banned");
        return null;
      }
      if ((page === "login" || page === "register") && me0) {
        location.replace(me0.role === "admin" ? "admin.html" : "profile.html");
        return null;
      }
      if (page === "profile" && !me0) {
        location.replace("login.html");
        return null;
      }
      if (page === "profile" && me0) hydrateProfile(me0);

      if (page === "login") {
        var params = new URLSearchParams(location.search);
        var msg = params.get("msg");
        if (msg === "banned" && window.toast) {
          toast("Аккаунт заблокирован администратором", "bad");
        } else if (msg === "deauth" && window.toast) {
          toast("Вы деавторизованы. Войдите заново.");
        }
      }
      return page === "profile" ? me0 : null;
    }
    return null;
  }

  /* ------------------------------------------------- nav: вход сохранён */
  function updateNavAuth(me) {
    if (!me) return;

    $$("[data-guest-only]").forEach(function (el) { el.hidden = true; });
    $$("[data-auth-only]").forEach(function (el) { el.hidden = false; });

    var actions = $(".nav__actions");
    if (actions && ($('a[href="login.html"]', actions) || $('a[href="register.html"]', actions))) {
      var toggle = $(".nav__toggle", actions);
      actions.innerHTML =
        '<a class="btn btn--ghost btn--sm" href="profile.html"><svg class="i"><use href="#i-user"></use></svg>' +
        esc(me.login) + "</a>" +
        '<button class="btn btn--quiet btn--sm" type="button" data-nav-logout><svg class="i"><use href="#i-logout"></use></svg>Выйти</button>' +
        (toggle ? toggle.outerHTML : "");
    }
    var sheet = $(".nav__sheet");
    var sheetActions = sheet && $(".nav__sheet-actions", sheet);
    if (sheetActions && ($('a[href="login.html"]', sheet) || $('a[href="register.html"]', sheet))) {
      sheetActions.innerHTML =
        '<a class="btn btn--ghost btn--sm" href="profile.html">Профиль</a>' +
        '<button class="btn btn--primary btn--sm" type="button" data-nav-logout>Выйти</button>';
    }
    $$("[data-nav-logout]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        await S.logout();
        location.replace("login.html");
      });
    });
  }

  /* ------------------------------------------------------- деавторизация */
  function bindDeauth() {
    $$("[data-deauth]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        btn.disabled = true;
        await S.logout();
        location.replace("login.html?msg=deauth");
      });
    });
  }

  /* -------------------------------------------------------------- общий чат */
  function initChat(me) {
    var chat = $("[data-chat]");
    if (!chat || !me) return;
    var log = $(".chat__log", chat);
    var form = $(".chat__form", chat);
    var input = $("input", form);
    var lastId = 0;
    var cleared = false;
    var avatarCache = {};

    function time(ts) {
      var d = new Date(ts);
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function render(m) {
      var el = document.createElement("div");
      el.className = "chat__msg";
      var av = document.createElement("div");
      av.className = "avatar";
      av.setAttribute("data-chat-avatar", m.login);
      if (avatarCache[m.login]) {
        av.innerHTML = '<img src="' + avatarCache[m.login] + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      } else {
        av.textContent = String(m.login).slice(0, 2).toUpperCase();
      }
      var wrap = document.createElement("div");
      var author = document.createElement("div");
      author.className = "chat__author";
      author.appendChild(document.createTextNode(m.login + (m.login === me.login ? " (вы)" : "")));
      var stamp = document.createElement("span");
      stamp.textContent = time(m.at);
      author.appendChild(stamp);
      var body = document.createElement("div");
      body.className = "chat__body";
      body.textContent = m.text;
      wrap.appendChild(author);
      wrap.appendChild(body);
      el.appendChild(av);
      el.appendChild(wrap);
      return el;
    }

    function refreshAvatars() {
      var need = {};
      $$("[data-chat-avatar]", log).forEach(function (el) {
        var l = el.getAttribute("data-chat-avatar");
        if (!avatarCache[l]) need[l] = true;
      });
      var logins = Object.keys(need);
      if (!logins.length) return;
      fetch("/api/avatars?logins=" + encodeURIComponent(logins.join(",")))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) return;
          Object.keys(d.avatars).forEach(function (l) { avatarCache[l] = d.avatars[l]; });
          $$("[data-chat-avatar]", log).forEach(function (el) {
            var l = el.getAttribute("data-chat-avatar");
            if (avatarCache[l] && !el.querySelector("img")) {
              el.innerHTML = '<img src="' + avatarCache[l] + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
            }
          });
        }).catch(function () {});
    }

    async function load() {
      var r = await S.chatGet(lastId);
      if (!r.ok) return;
      var msgs = r.messages || [];
      if (!cleared) {
        cleared = true;
        log.innerHTML = "";
        if (!msgs.length) {
          var empty = document.createElement("div");
          empty.className = "chat__msg text-dim";
          empty.style.fontSize = "var(--fs-sm)";
          empty.textContent = "Сообщений пока нет — напишите первым!";
          log.appendChild(empty);
          return;
        }
      }
      msgs.forEach(function (m) {
        lastId = Math.max(lastId, m.id);
        log.appendChild(render(m));
      });
      while (log.children.length > 80) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
      refreshAvatars();
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      var r = await S.chatSend(text);
      if (!r.ok) {
        toast(r.error || "Сообщение не отправлено", "bad");
        input.value = text;
        return;
      }
      await load();
    });

    load();
    setInterval(load, 4000);
  }

  /* ------------------------------------------------------- живой счётчик */
  function initLivePlayers() {
    var el = $("[data-live-players]");
    if (!el) return;
    async function tick() {
      try {
        var r = await fetch("/api/public-stats");
        var d = await r.json();
        if (d && typeof d.players === "number") el.textContent = d.players;
      } catch (e) {}
    }
    tick();
    setInterval(tick, 60000);
  }

  /* ------------------------------------------------------ модалка покупки */
  function ensureModal() {
    var m = $("[data-buy-modal]");
    if (m) return m;
    m = document.createElement("div");
    m.className = "modal";
    m.hidden = true;
    m.setAttribute("data-buy-modal", "");
    m.innerHTML =
      '<div class="modal__backdrop" data-modal-close></div>' +
      '<div class="modal__card" role="dialog" aria-modal="true" aria-label="Покупка подписки">' +
      '<button class="btn btn--quiet btn--sm modal__x" type="button" data-modal-close aria-label="Закрыть">' +
      '<svg class="i"><use href="#i-close"></use></svg></button>' +
      '<div data-modal-body></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", function (e) {
      if (e.target.closest("[data-modal-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !m.hidden) closeModal();
    });
    return m;
  }

  function closeModal() {
    var m = $("[data-buy-modal]");
    if (m) m.hidden = true;
  }

  function orderCode() {
    var abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var s = "";
    for (var i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return "AE-" + s;
  }

  function openBuyModal(planCode) {
    var info = PLAN_INFO[planCode];
    if (!info) return;
    var m = ensureModal();
    var body = $("[data-modal-body]", m);

    var methods = METHODS.map(function (x, i) {
      return (
        '<button class="pay__btn" type="button" data-method="' + i + '">' +
        '<span class="pay__logo">' + esc(x.name.slice(0, 2).toUpperCase()) + "</span>" +
        "<span><span class='pay__name'>" + esc(x.name) + "</span>" +
        "<span class='pay__desc'>" + esc(x.desc) + "</span></span>" +
        '<svg class="i"><use href="#i-chevron-right"></use></svg></button>'
      );
    }).join("");

    body.innerHTML =
      '<span class="eyebrow">Покупка подписки</span>' +
      '<h3 style="font-size:var(--fs-xl);margin-top:var(--sp-2)">' + esc(info.name) + " · " + esc(info.price) + "</h3>" +
      '<p class="text-dim" style="font-size:var(--fs-sm);margin-top:var(--sp-1)">Срок: ' + esc(info.term) + ". Ключ приходит после подтверждения оплаты.</p>" +
      '<div class="promo-row">' +
      '<input class="input input--mono" data-promo-input placeholder="ПРОМОКОД" maxlength="24" autocomplete="off" style="text-transform:uppercase">' +
      '<button class="btn btn--ghost" type="button" data-promo-apply>Применить</button>' +
      "</div>" +
      '<p class="text-dim" data-promo-status style="font-size:var(--fs-sm);min-height:1.2em;margin-top:var(--sp-2)"></p>' +
      '<div class="pay">' + methods + "</div>";

    var promoInput = $("[data-promo-input]", body);
    var status = $("[data-promo-status]", body);
    var promo = { code: "", percent: 0 };

    function finalPrice() {
      var base = parseInt(info.price, 10) || 0;
      var val = promo.percent > 0 ? Math.round(base * (100 - promo.percent) / 100) : base;
      return val + " ₽";
    }

    $("[data-promo-apply]", body).addEventListener("click", async function () {
      var code = promoInput.value.trim().toUpperCase();
      if (!code) { status.textContent = "Введите промокод"; return; }
      var r = await S.promoCheck(code);
      if (!r.ok) {
        promo = { code: "", percent: 0 };
        status.innerHTML = '<span style="color:var(--bad)">' + esc(r.error) + "</span>";
        return;
      }
      promo = { code: code, percent: r.percent };
      status.innerHTML = '<span style="color:var(--ok)">Промокод применён: −' + r.percent +
        "% → " + finalPrice() + " вместо " + esc(info.price) + "</span>";
    });

    $$("[data-method]", body).forEach(function (btn) {
      btn.addEventListener("click", function () {
        showInstructions(info, METHODS[parseInt(btn.dataset.method, 10)], promo);
      });
    });

    m.hidden = false;
  }

  function showInstructions(info, method, promo) {
    var m = $("[data-buy-modal]");
    var body = $("[data-modal-body]", m);
    var order = orderCode();
    var link = method.link || PAY.tg;
    promo = promo || { code: "", percent: 0 };
    var base = parseInt(info.price, 10) || 0;
    var total = promo.percent > 0 ? Math.round(base * (100 - promo.percent) / 100) : base;

    var promoLine = promo.percent > 0
      ? '<p style="margin-top:var(--sp-3);font-size:var(--fs-sm)">К оплате: <b style="font-size:var(--fs-lg);color:var(--ok)">' + total +
        " ₽</b> <s class='text-dim'>" + base + " ₽</s> <span class='badge badge--ok'>−" + promo.percent + "% по " + esc(promo.code) + "</span></p>"
      : '<p style="margin-top:var(--sp-3);font-size:var(--fs-sm)">К оплате: <b style="font-size:var(--fs-lg)">' + base + " ₽</b></p>";

    body.innerHTML =
      '<span class="eyebrow">' + esc(method.name) + "</span>" +
      '<h3 style="font-size:var(--fs-xl);margin-top:var(--sp-2)">' + esc(info.name) + " · " + esc(info.term) + "</h3>" +
      promoLine +
      '<ol class="steps">' +
      "<li>Оплатите заказ <b class='mono'>" + esc(order) + "</b> через " + esc(method.name) + ".</li>" +
      "<li>Напишите в поддержку: номер заказа и ваш логин.</li>" +
      "<li>Получите ключ AETH-XXXX-XXXX и активируйте его во вкладке «Подписка».</li>" +
      "</ol>" +
      '<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-5)">' +
      '<a class="btn btn--primary" href="' + esc(link) + '" target="_blank" rel="noopener" data-pay-go>' +
      '<svg class="i"><use href="#i-zap"></use></svg> Перейти к оплате</a>' +
      '<a class="btn btn--ghost" href="' + esc(PAY.tg) + '" target="_blank" rel="noopener">' +
      '<svg class="i"><use href="#i-send"></use></svg> Поддержка</a>' +
      "</div>" +
      '<p class="text-dim" style="font-size:var(--fs-xs);margin-top:var(--sp-4)">Зачисление до 5 минут. Ключ активируется во вкладке «Подписка» — срок пойдёт с момента активации.</p>';

    var go = $("[data-pay-go]", body);
    if (go && promo.code) {
      go.addEventListener("click", function () { S.promoUse(promo.code); });
    }

    m.hidden = false;
  }

  function initBuyButtons(me) {
    $$("[data-buy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!me) {
          toast("Войдите в аккаунт, чтобы купить подписку", "bad");
          setTimeout(function () { location.href = "login.html"; }, 600);
          return;
        }
        openBuyModal(btn.dataset.buy);
      });
    });
  }

  /* ------------------------------------------------------------ аватарка */
  function initAvatar() {
    var btn = $("[data-avatar-btn]");
    var input = $("[data-avatar-input]");
    if (!btn || !input) return;

    btn.addEventListener("click", function () { input.click(); });

    input.addEventListener("change", async function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast("Только PNG, JPG или WebP", "bad"); return; }
      if (file.size > 5 * 1024 * 1024) { toast("Файл больше 5 МБ", "bad"); return; }

      var dataUrl = await new Promise(function (res) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.readAsDataURL(file);
      });
      var img = await new Promise(function (res) {
        var i = new Image();
        i.onload = function () { res(i); };
        i.src = dataUrl;
      });

      var size = 128;
      var canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      var side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      var out = canvas.toDataURL("image/jpeg", 0.85);

      btn.disabled = true;
      var r = await S.setAvatar(out);
      btn.disabled = false;
      if (!r.ok) { toast(r.error || "Не удалось загрузить аватарку", "bad"); return; }
      toast("Аватарка обновлена");
      hydrateProfile(await S.current());
    });
  }

  /* ------------------------------------------------- Cloudflare Turnstile */
  var tsToken = "";
  var tsWidget = null;

  function initTurnstile() {
    var form = $('form[data-auth="register"]');
    if (!form) return;

    var wrap = document.createElement("div");
    wrap.className = "field";
    wrap.hidden = true;
    wrap.innerHTML =
      '<label class="field__label">Подтвердите, что вы не робот</label>' +
      '<div data-turnstile></div>';
    var submitBtn = $('button[type="submit"]', form);
    submitBtn.parentNode.insertBefore(wrap, submitBtn);

    fetch("/api/config").then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg.ok || !cfg.turnstileSiteKey) return;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function () {
        try {
          tsWidget = window.turnstile.render($("[data-turnstile]", wrap), {
            sitekey: cfg.turnstileSiteKey,
            callback: function (t) { tsToken = t; },
            "expired-callback": function () { tsToken = ""; }
          });
          wrap.hidden = false;
        } catch (e) {}
      };
      document.head.appendChild(s);
    }).catch(function () {});
  }

  /* --------------------------------------------------- HWID и лоадер */
  async function refreshHwid() {
    var r = await S.loaderInfo();
    if (!r.ok) return;
    var kv = $('[data-kv="hwid"]');
    if (kv) kv.textContent = r.hwid ? r.hwidMasked : "Не привязан";
    var badge = $("[data-hwid-badge]");
    if (badge) {
      badge.className = "badge" + (r.hwid ? " badge--ok" : "");
      badge.textContent = r.hwid ? "HWID привязан" : "HWID не привязан";
    }
    var resets = $("[data-hwid-resets]");
    if (resets) resets.textContent = r.resetsLeft + " / " + r.resetLimit;
    var resetBtn = $("[data-hwid-reset]");
    if (resetBtn) resetBtn.disabled = !r.hwid || r.resetsLeft <= 0;
  }

  function initHwid() {
    var resetBtn = $("[data-hwid-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", async function () {
        resetBtn.disabled = true;
        var r = await S.hwidReset();
        if (!r.ok) { toast(r.error || "Ошибка", "bad"); refreshHwid(); return; }
        toast("HWID сброшен. Следующий вход с любого ПК привяжет его заново");
        refreshHwid();
      });
    }

    var dl = $("[data-download-loader]");
    if (dl) {
      dl.addEventListener("click", function (e) {
        e.preventDefault();
        var t = S.hasToken();
        if (!t) { toast("Войдите в аккаунт", "bad"); return; }
        toast("Проверяем подписку…");
        S.loaderInfo().then(function (r) {
          if (r.ok && r.subActive) {
            window.location.href = "/api/download/loader?t=" + encodeURIComponent(t);
          } else {
            toast("Нужна активная подписка — купите ключ во вкладке «Купить ключ»", "bad");
          }
        });
      });
    }
  }

  /* ----------------------------------------------------------------- forms */
  function bindLiveValidation(inputs) {
    inputs.forEach(function (input) {
      input.addEventListener("blur", function () { validate(input); });
      input.addEventListener("input", function () {
        if (input.closest(".field").classList.contains("is-invalid")) validate(input);
      });
    });
  }

  function initLoginForm() {
    var form = $('form[data-auth="login"]');
    if (!form) return;
    var inputs = $$("input[data-rule]", form);
    bindLiveValidation(inputs);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!inputs.map(validate).every(Boolean)) return;

      busy(form, true);
      var remember = !!$('input[name="remember"]', form).checked;
      var res = await S.authenticate($("#loginName").value.trim(), $("#loginPw").value, remember);
      busy(form, false);

      if (!res.ok) {
        if (res.banned) toast(res.error, "bad");
        else fieldError($("#loginPw"), res.error || "Ошибка входа");
        return;
      }
      toast("Вход выполнен. Привет, " + res.user.login + "!");
      setTimeout(function () {
        location.replace(res.user.role === "admin" ? "admin.html" : "profile.html");
      }, 450);
    });
  }

  function initRegisterForm() {
    var form = $('form[data-auth="register"]');
    if (!form) return;
    var inputs = $$("input[data-rule]", form);
    bindLiveValidation(inputs);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var ok = inputs.map(validate).every(Boolean);
      var agree = $('input[name="agree"]', form);
      if (agree && !agree.checked) {
        ok = false;
        toast("Примите условия использования", "bad");
      }
      if (!ok) return;

      busy(form, true, "Создаём…");
      var res = await S.register(
        $("#regLogin").value.trim(),
        $("#regEmail").value.trim(),
        $("#regPw").value,
        tsToken
      );
      busy(form, false);

      if (!res.ok) {
        if (res.error.indexOf("Cloudflare") > -1 && tsWidget !== null && window.turnstile) {
          window.turnstile.reset(tsWidget);
          tsToken = "";
        }
        var isLoginErr = res.error.indexOf("логин") > -1;
        var isEmailErr = res.error.indexOf("e-mail") > -1;
        fieldError($("#regLogin"), isLoginErr ? res.error : "");
        fieldError($("#regEmail"), isEmailErr ? res.error : "");
        if (!isLoginErr && !isEmailErr) toast(res.error || "Ошибка регистрации", "bad");
        return;
      }
      toast("Аккаунт создан. Добро пожаловать!");
      setTimeout(function () { location.replace("profile.html"); }, 450);
    });
  }

  function initKeyForm() {
    var form = $('form[data-auth="key"]');
    if (!form) return;
    var input = $("#keyInput");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validate(input)) return;
      busy(form, true);
      var res = await S.redeem(input.value);
      busy(form, false);

      if (!res.ok) {
        fieldError(input, res.error);
        toast(res.error, "bad");
        return;
      }
      form.reset();
      toast("Ключ активирован: +" + (res.plan.days == null ? "навсегда" : res.plan.days + " дн."));
      hydrateProfile(await S.current());
    });
  }

  function initPasswordForm() {
    var form = $('form[data-auth="password"]');
    if (!form) return;
    var inputs = $$("input[data-rule]", form);
    bindLiveValidation(inputs);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!inputs.map(validate).every(Boolean)) return;
      busy(form, true, "Сохраняем…");
      var res = await S.changePassword($("#pwCurrent").value, $("#pwNew").value);
      busy(form, false);

      if (!res.ok) {
        fieldError($("#pwCurrent"), res.error || "Ошибка");
        toast(res.error || "Ошибка", "bad");
        return;
      }
      form.reset();
      toast("Пароль изменён. Не забудьте его!");
    });
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function boot() {
    if (!S) return;
    window.addEventListener("aethra:offline", showOfflineBanner);
    var page = document.body.dataset.authPage;
    var me;

    if (page) {
      me = await handleGuards();
    } else {
      me = await S.current();
      if (me && me.banned) {
        await S.logout();
        me = null;
      }
    }

    document.body.classList.add("auth-ready");
    injectAdminLink(me);
    updateNavAuth(me);
    bindDeauth();
    initChat(me);
    initAvatar();
    initHwid();
    refreshHwid();
    initLivePlayers();
    initBuyButtons(me);
    initTurnstile();
    initLoginForm();
    initRegisterForm();
    initKeyForm();
    initPasswordForm();
  }

  boot();
})();
