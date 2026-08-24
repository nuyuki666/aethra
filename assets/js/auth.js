/* ==========================================================================
   Aethra — auth & account behaviour (login / register / profile pages)
   ========================================================================== */
(function () {
  "use strict";

  var S = window.AethraStore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

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
    $$("[data-user-avatar]").forEach(function (el) { el.textContent = me.login.slice(0, 2).toUpperCase(); });
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
      av.textContent = String(m.login).slice(0, 2).toUpperCase();
      var wrap = document.createElement("div");
      var author = document.createElement("div");
      author.className = "chat__author";
      var name = document.createElement("span");
      name.textContent = "";
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
        $("#regPw").value
      );
      busy(form, false);

      if (!res.ok) {
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
    initLoginForm();
    initRegisterForm();
    initKeyForm();
    initPasswordForm();
  }

  boot();
})();
