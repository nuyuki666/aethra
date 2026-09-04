/* ==========================================================================
   Aethra — auth & account behaviour (login / register / profile pages)
   v1.0.4 - Updated payment methods and footer icons
   ========================================================================== */
(function () {
  "use strict";

  var S = window.AethraStore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var PAY = {
    tg: "https://t.me/aethra_helper",
    channel: "https://t.me/aethra_dlc",
    support: "https://t.me/aethra_helper",
    platega: "https://my.platega.io/"
  };
  var PLAN_INFO = {
    week: { name: "Неделя", price: "100 ₽", term: "7 дней" },
    month: { name: "Месяц", price: "300 ₽", term: "30 дней" },
    life: { name: "Навсегда", price: "450 ₽", term: "бессрочно" },
    "hwid-reset": { name: "Сброс HWID", price: "200 ₽", term: "разовая услуга" }
  };
  var PRODUCTS = {
    cs2: { name: "Aethra CS2", desc: "DLC для Counter-Strike 2", img: "/cs.png" },
    minecraft: { name: "Aethra DLC", desc: "DLC для Minecraft", img: "/minecraft.png" },
    visual: { name: "Aethra Visual", desc: "Визуальное DLC для PvP", img: "/minecraft.png" }
  };
  var PAYMENT_METHODS = [
    { id: "sbp", name: "Система быстрых платежей", icon: "img:assets/images/spb.png" },
    { id: "crypto", name: "Криптовалюта", icon: "crypto" },
    { id: "support", name: "Через техподдержку", icon: "img:assets/images/tech.png" }
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
    $$("[data-auth-hide]").forEach(function (el) { el.hidden = true; });

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
    var purchasesEl = $("[data-monthly-purchases]");
    if (!el && !purchasesEl) return;
    async function tick() {
      try {
        var r = await fetch("/api/public-stats");
        var d = await r.json();
        if (d && typeof d.players === "number" && el) el.textContent = d.players;
        if (d && typeof d.purchases === "number" && purchasesEl) purchasesEl.textContent = d.purchases;
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

  function openBuyModal(planCode, productCode) {
    var info = PLAN_INFO[planCode];
    if (!info) return;
    var m = ensureModal();
    var body = $("[data-modal-body]", m);

    // Сначала показываем выбор товара
    var productBtns = Object.keys(PRODUCTS).map(function(code) {
      var p = PRODUCTS[code];
      return '<button class="server" type="button" data-select-product="' + code + '" style="cursor:pointer;border:none;background:none;padding:var(--sp-3);border-radius:12px;transition:all .2s;width:100%;text-align:left;margin-bottom:var(--sp-2);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:var(--sp-3)">' +
        '<div style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">' +
        '<img src="' + esc(p.img) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block" /></div>' +
        '<div style="flex:1;min-width:0"><div class="server__name">' + esc(p.name) + '</div>' +
        '<div class="server__meta">' + esc(p.desc) + '</div></div>' +
        '<svg class="i" style="opacity:0.4;flex-shrink:0"><use href="#i-chevron-right"></use></svg>' +
        '</button>';
    }).join("");

    body.innerHTML =
      '<span class="eyebrow">Покупка подписки</span>' +
      '<h3 style="font-size:var(--fs-xl);margin-top:var(--sp-2)">' + esc(info.name) + " · " + esc(info.price) + "</h3>" +
      '<p class="text-dim" style="font-size:var(--fs-sm);margin-top:var(--sp-2)">Выберите товар:</p>' +
      '<div style="margin-top:var(--sp-3)">' + productBtns + '</div>';

    $$("[data-select-product]", body).forEach(function(btn) {
      btn.addEventListener("click", function() {
        var selectedProduct = btn.dataset.selectProduct;
        showPaymentMethods(planCode, selectedProduct, m, body);
      });
    });

    m.hidden = false;
  }

  function showPaymentMethods(planCode, productCode, m, body) {
    var info = PLAN_INFO[planCode];
    var product = PRODUCTS[productCode];
    if (!info || !product) return;

    var base = parseInt(info.price, 10) || 0;
    var selectedMethod = null;
    var promo = { code: "", percent: 0 };

    function finalPrice() {
      var amt = base;
      if (promo.percent > 0) amt = Math.round(amt * (100 - promo.percent) / 100);
      return amt + " ₽";
    }

    function render() {
      var methods = PAYMENT_METHODS.map(function (x) {
        var iconHtml = x.icon.indexOf("img:") === 0
          ? '<img src="' + esc(x.icon.slice(4)) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">'
          : '<svg class="i"><use href="#i-' + x.icon + '"></use></svg>';
        return '<button class="pay-row' + (selectedMethod === x.id ? " pay-row--active" : "") +
          '" type="button" data-pay-method="' + x.id + '">' +
          '<div class="pay-row__icon">' + iconHtml + '</div>' +
          '<span class="pay-row__name">' + esc(x.name) + '</span>' +
          '<svg class="i pay-row__chevron"><use href="#i-chevron-right"></use></svg>' +
          '</button>';
      }).join("");

      body.innerHTML =
        '<h2 style="font-size:20px;font-weight:800;color:#dce4ef;margin:0 0 16px 0;line-height:1.2">' + esc(product.name) + '</h2>' +
        '<div class="pay-product">' +
          '<div class="pay-product__info">' +
            '<div class="pay-product__name">' + esc(product.name) + '</div>' +
            '<div class="pay-product__desc">' + esc(info.name) + ' · ' + esc(info.term) + '</div>' +
          '</div>' +
          '<div class="pay-product__price">' +
            '<div class="pay-product__amount">' + esc(info.price) + '</div>' +
            '<span class="pay-product__badge">РАЗОВЫЙ ПЛАТЕЖ</span>' +
          '</div>' +
        '</div>' +
        '<p style="margin:20px 0 8px;font-size:11px;font-weight:600;color:rgba(184,213,255,0.4);letter-spacing:0.08em;text-transform:uppercase">СПОСОБ ОПЛАТЫ</p>' +
        '<div class="pay-list">' + methods + '</div>' +
        '<p style="margin:20px 0 8px;font-size:11px;font-weight:600;color:rgba(184,213,255,0.4);letter-spacing:0.08em;text-transform:uppercase">ПРОМОКОД</p>' +
        '<div class="promo-row">' +
        '<input class="input" data-promo-input placeholder="Введите код, например AETHRA" maxlength="24" autocomplete="off">' +
        '</div>' +
        '<p data-promo-status style="font-size:12px;min-height:16px;margin-top:6px;color:rgba(184,213,255,0.5)"></p>' +
        '<button class="pay-submit" type="button" data-pay-submit disabled>' +
        'Оплатить ' + esc(finalPrice()) + '</button>';

      bindEvents();
    }

    function bindEvents() {
      $$("[data-pay-method]", body).forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedMethod = btn.dataset.payMethod;
          $$(".pay-row", body).forEach(function (c) { c.classList.remove("pay-row--active"); });
          btn.classList.add("pay-row--active");
          updateSubmit();
        });
      });

      var promoInput = $("[data-promo-input]", body);
      var status = $("[data-promo-status]", body);

      $("[data-promo-apply]", body).addEventListener("click", async function () {
        var code = promoInput.value.trim().toUpperCase();
        if (!code) { status.textContent = "Введите промокод"; return; }
        var r = await S.promoCheck(code, productCode);
        if (!r.ok) {
          promo = { code: "", percent: 0 };
          status.innerHTML = '<span style="color:var(--bad)">' + esc(r.error) + "</span>";
          return;
        }
        promo = { code: code, percent: r.percent };
        status.innerHTML = '<span style="color:var(--ok)">Применено: −' + r.percent +
          "% → " + finalPrice() + "</span>";
        updateSubmit();
      });

      updateSubmit();
    }

    function updateSubmit() {
      var btn = $("[data-pay-submit]", body);
      if (!btn) return;
      var disabled = !selectedMethod;
      btn.disabled = disabled;
      btn.textContent = "Оплатить " + finalPrice();
      btn.onclick = disabled ? null : function () {
        showInstructions(info, selectedMethod, promo, productCode, base);
      };
    }

    render();
  }

  function showInstructions(info, methodId, promo, productCode, amount) {
    var m = $("[data-buy-modal]");
    var body = $("[data-modal-body]", m);
    var order = orderCode();
    promo = promo || { code: "", percent: 0 };
    var total = amount || parseInt(info.price, 10) || 0;

    var methodInfo = null;
    PAYMENT_METHODS.forEach(function (x) {
      if (x.id === methodId) methodInfo = x;
    });
    if (!methodInfo) methodInfo = { name: methodId, icon: "credit-card" };

    var isSupport = methodId === "support";

    var promoLine = promo.percent > 0
      ? '<p style="margin-top:12px;font-size:13px">К оплате: <b style="font-size:18px;color:#74ff89">' + total +
        " ₽</b> <s style='color:rgba(184,213,255,0.3)'>" + parseInt(info.price, 10) + " ₽</s></p>"
      : '<p style="margin-top:12px;font-size:13px">К оплате: <b style="font-size:18px;color:#dce4ef">' + total + " ₽</b></p>";

    var steps;
    if (isSupport) {
      steps = '<ol class="steps">' +
        "<li>Напишите в поддержку: укажите товар, сумму и способ оплаты.</li>" +
        "<li>Получите ключ формата <b class='mono'>AETH-XXXX-XXXX</b>.</li>" +
        "<li>Активируйте ключ во вкладке «Подписка».</li>" +
        "</ol>";
    } else {
      steps = '<ol class="steps">' +
        "<li>Вы будете перенаправлены на страницу оплаты.</li>" +
        "<li>Оплатите заказ <b class='mono'>" + esc(order) + "</b>.</li>" +
        "<li>Ключ придёт автоматически после подтверждения оплаты.</li>" +
        "</ol>";
    }

    var payBtn;
    if (isSupport) {
      payBtn = '<a class="pay-submit" href="' + esc(PAY.tg) + '" target="_blank" rel="noopener" style="text-decoration:none;display:flex;align-items:center;justify-content:center">' +
        'Написать в поддержку</a>';
    } else {
      payBtn = '<button class="pay-submit" type="button" data-pay-go>Перейти к оплате</button>';
    }

    body.innerHTML =
      '<h2 style="font-size:20px;font-weight:800;color:#dce4ef;margin:0 0 16px 0;line-height:1.2">' + esc(productCode ? PRODUCTS[productCode].name : "") + '</h2>' +
      '<div class="pay-product">' +
        '<div class="pay-product__info">' +
          '<div class="pay-product__name">' + esc(info.name) + '</div>' +
          '<div class="pay-product__desc">' + esc(info.term) + '</div>' +
        '</div>' +
        '<div class="pay-product__price">' +
          '<div class="pay-product__amount">' + esc(info.price) + '</div>' +
          '<span class="pay-product__badge">ОПЛАТА</span>' +
        '</div>' +
      '</div>' +
      '<p style="margin:20px 0 8px;font-size:11px;font-weight:600;color:rgba(184,213,255,0.4);letter-spacing:0.08em;text-transform:uppercase">' + esc(methodInfo.name) + '</p>' +
      promoLine +
      steps +
      payBtn +
      '<p style="font-size:11px;color:rgba(184,213,255,0.3);margin-top:16px;text-align:center">' +
      'Если после оплаты прошло более 30 минут, а ключ не пришёл — напишите в техподдержку.' +
      '</p>';

    if (!isSupport) {
      var go = $("[data-pay-go]", body);
      if (go) {
        go.addEventListener("click", async function () {
          go.disabled = true;
          go.textContent = "Создаём платёж…";
          try {
            var planCode = Object.keys(PLAN_INFO).find(function (k) { return PLAN_INFO[k].name === info.name; }) || "month";
            var resp = await fetch("/api/platega/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: planCode,
                product: productCode,
                method: methodId
              })
            });
            var data = await resp.json();
            if (data.ok && data.payment_url) {
              if (promo.code) S.promoUse(promo.code);
              window.location.href = data.payment_url;
            } else {
              go.disabled = false;
              go.textContent = "Перейти к оплате";
              toast(data.error || "Ошибка создания платежа", "bad");
            }
          } catch (e) {
            go.disabled = false;
            go.textContent = "Перейти к оплате";
            toast("Ошибка сети", "bad");
          }
        });
      }
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
        openBuyModal(btn.dataset.buy, null);
      });
    });
    $$("[data-buy-product]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!me) {
          toast("Войдите в аккаунт, чтобы купить подписку", "bad");
          setTimeout(function () { location.href = "login.html"; }, 600);
          return;
        }
        openBuyModalWithProduct(btn.dataset.buyProduct);
      });
    });
  }

  function openBuyModalWithProduct(productCode) {
    var m = ensureModal();
    var body = $("[data-modal-body]", m);
    var info = PLAN_INFO["month"];
    var product = PRODUCTS[productCode];
    if (!info || !product) return;

    body.innerHTML =
      '<h2 style="font-size:20px;font-weight:800;color:#dce4ef;margin:0 0 16px 0;line-height:1.2">' + esc(product.name) + '</h2>' +
      '<p style="font-size:13px;color:rgba(184,213,255,0.45);margin-bottom:20px">' + esc(product.desc) + '</p>' +
      '<p style="font-size:11px;font-weight:600;color:rgba(184,213,255,0.4);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Выберите тариф</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      Object.keys(PLAN_INFO).map(function (code) {
        var p = PLAN_INFO[code];
        return '<button class="pay-row" type="button" data-select-plan="' + code + '" data-select-product="' + productCode + '">' +
          '<div class="pay-row__icon" style="background:rgba(184,213,255,0.04)"><svg class="i"><use href="#i-zap"></use></svg></div>' +
          '<div style="flex:1"><div class="pay-row__name">' + esc(p.name) + '</div>' +
          '<div style="font-size:11px;color:rgba(184,213,255,0.35)">' + esc(p.term) + '</div></div>' +
          '<span style="font-size:14px;font-weight:700;color:#dce4ef">' + esc(p.price) + '</span>' +
          '<svg class="i pay-row__chevron"><use href="#i-chevron-right"></use></svg>' +
          '</button>';
      }).join("") +
      '</div>';

    $$("[data-select-plan]", body).forEach(function (btn) {
      btn.addEventListener("click", function () {
        showPaymentMethods(btn.dataset.selectPlan, btn.dataset.selectProduct, m, body);
      });
    });

    m.hidden = false;
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
  var captchaId = "";
  var captchaReload = null;

  function initTurnstile() {
    var form = $('form[data-auth="register"]');
    if (!form || $("[data-captcha-field]", form)) return;

    var wrap = document.createElement("div");
    wrap.className = "field captcha-field";
    wrap.setAttribute("data-captcha-field", "");
    wrap.innerHTML =
      '<label class="field__label" for="captchaAnswer">Проверка безопасности</label>' +
      '<div class="captcha-box" data-local-captcha>' +
        '<span class="captcha-question" data-captcha-question>Загрузка…</span>' +
        '<span class="captcha-equals">=</span>' +
        '<input class="input captcha-answer" id="captchaAnswer" name="captchaAnswer" type="text" inputmode="numeric" autocomplete="off" placeholder="Ответ" aria-describedby="captchaHint">' +
      '</div>' +
      '<p class="field__hint" id="captchaHint">Решите пример, чтобы продолжить регистрацию.</p>' +
      '<div class="turnstile-slot" data-turnstile></div>' +
      '<p class="field__error" role="alert"></p>';
    var submitBtn = $('button[type="submit"]', form);
    submitBtn.parentNode.insertBefore(wrap, submitBtn);

    var answer = $("#captchaAnswer", wrap);
    var localBox = $("[data-local-captcha]", wrap);
    var hint = $("#captchaHint", wrap);
    var question = $("[data-captcha-question]", wrap);

    captchaReload = function () {
      fetch("/api/config").then(function (r) { return r.json(); }).then(function (cfg) {
        if (cfg.captcha) {
          captchaId = cfg.captcha.id;
          question.textContent = cfg.captcha.question;
          answer.value = "";
          answer.disabled = false;
          localBox.hidden = false;
          hint.textContent = "Решите пример, чтобы продолжить регистрацию.";
          return;
        }
        captchaId = "";
        answer.value = "";
        answer.disabled = true;
        localBox.hidden = true;
        hint.textContent = "Подтвердите, что вы не робот.";
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
          } catch (e) {}
        };
        document.head.appendChild(s);
      }).catch(function () {
        hint.textContent = "Не удалось загрузить проверку. Обновите страницу.";
      });
    };
    captchaReload();
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

  function detectDeviceType() {
    var ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return "smartphone";
    if (/iPhone|iPad|iPod/i.test(ua)) return "smartphone";
    return "desktop";
  }

  function updateSessionIcon() {
    var icon = $("[data-session-icon]");
    var meta = $("[data-session-meta]");
    if (!icon || !meta) return;
    
    var deviceType = detectDeviceType();
    var ua = navigator.userAgent || "";
    var browser = "Browser";
    if (ua.indexOf("Chrome") > -1 && ua.indexOf("Edg") === -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
    else if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("Edg") > -1) browser = "Edge";
    
    var os = "Unknown";
    if (ua.indexOf("Windows") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "macOS";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) os = "iOS";
    
    var iconName = deviceType === "smartphone" ? "smartphone" : "monitor";
    icon.innerHTML = '<svg class="i i--lg"><use href="#i-' + iconName + '"></use></svg>';
    icon.setAttribute("data-session-icon", deviceType);
    
    meta.textContent = os + " · " + browser + " · Последний вход: только что";
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

    var downloadLoader = $("[data-download-loader]");
    if (downloadLoader) {
      downloadLoader.addEventListener("click", function (e) {
        e.preventDefault();
        var t = S.hasToken();
        if (!t) {
          toast("Войдите в аккаунт", "bad");
          return;
        }
        window.location.href = "/api/download/loader?t=" + encodeURIComponent(t);
        toast("Загрузка началась...");
      });
    }
    
    updateSessionIcon();
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
        tsToken,
        captchaId,
        $("#captchaAnswer", form) ? $("#captchaAnswer", form).value : ""
      );
      busy(form, false);

      if (!res.ok) {
        if (res.error && res.error.indexOf("Cloudflare") > -1 && tsWidget !== null && window.turnstile) {
          window.turnstile.reset(tsWidget);
          tsToken = "";
        }
        if (res.error && res.error.indexOf("капчи") > -1) {
          if (captchaReload) captchaReload();
        }
        var isLoginErr = res.error && res.error.indexOf("логин") > -1;
        var isEmailErr = res.error && res.error.indexOf("e-mail") > -1;
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

  /* ---------------------------------------------------- покупка сброса HWID */
  function initBuyHwidReset() {
    $$("[data-buy-hwid-reset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!S.current()) {
          toast("Войдите в аккаунт", "bad");
          setTimeout(function () { location.href = "login.html"; }, 600);
          return;
        }
        openBuyModal("hwid-reset");
      });
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
    initBuyHwidReset();
    initTurnstile();
    initLoginForm();
    initRegisterForm();
    initKeyForm();
    initPasswordForm();
  }

  boot();
})();
