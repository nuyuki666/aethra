/* ==========================================================================
   Aethra — admin panel behaviour
   ========================================================================== */
(function () {
  "use strict";

  var S = window.AethraStore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function guard() {
    var me = await S.current();
    if (!me || me.role !== "admin") {
      location.replace("login.html");
      return null;
    }
    $$("[data-admin-name]").forEach(function (el) { el.textContent = me.login; });
    return me;
  }

  /* ------------------------------------------------------------------ copy */
  function copyKey(code) {
    var done = function () { toast("Ключ скопирован: " + code); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { toast("Не удалось скопировать", "bad"); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Не удалось скопировать", "bad"); }
      ta.remove();
    }
  }

  /* ---------------------------------------------------------------- common */
  function subBadge(u) {
    if (u.banned) return '<span class="badge badge--bad">Бан</span>';
    if (u.lifetime) return '<span class="badge badge--ok">Навсегда</span>';
    if (u.subUntil > Date.now()) {
      var left = Math.ceil((u.subUntil - Date.now()) / 86400000);
      return '<span class="badge badge--ok">' + left + " дн.</span>";
    }
    if (u.subUntil) return '<span class="badge badge--bad">Истекла</span>';
    return '<span class="badge">Без подписки</span>';
  }

  async function renderAll() {
    await Promise.all([renderStats(), renderUsers(), renderKeys(), renderPromos()]);
  }

  /* -------------------------------------------------------------- overview */
  async function renderStats() {
    var st = await S.stats();
    Object.keys(st).forEach(function (k) {
      var el = $('[data-stat="' + k + '"]');
      if (el) el.textContent = st[k];
    });

    var recent = $("[data-recent]");
    if (!recent) return;
    var users = (await S.users())
      .sort(function (a, b) { return b.regAt - a.regAt; })
      .slice(0, 6);

    if (!users.length) {
      recent.innerHTML =
        '<div class="empty"><svg class="i"><use href="#i-inbox"></use></svg>' +
        "<p>Пока нет зарегистрированных пользователей.</p></div>";
      return;
    }
    recent.innerHTML =
      '<ul class="server-list">' +
      users.map(function (u) {
        return (
          '<li class="server">' +
          '<span class="avatar">' + esc(u.login.slice(0, 2).toUpperCase()) + "</span>" +
          "<div>" +
          '<div class="server__name">' + esc(u.login) +
          (u.role === "admin" ? ' <span class="badge badge--ok">admin</span>' : "") +
          "</div>" +
          '<div class="server__meta">' + esc(u.email) + " · " + S.fmtDateTime(u.regAt) + "</div>" +
          "</div>" +
          subBadge(u) +
          "</li>"
        );
      }).join("") +
      "</ul>";
  }

  /* ----------------------------------------------------------------- users */
  var userQuery = "";

  async function renderUsers() {
    var body = $("[data-users-body]");
    if (!body) return;

    var q = userQuery.trim().toLowerCase();
    var users = (await S.users()).filter(function (u) {
      if (!q) return true;
      return u.login.toLowerCase().indexOf(q) > -1 ||
             String(u.email).toLowerCase().indexOf(q) > -1 ||
             String(u.id) === q;
    }).sort(function (a, b) { return a.id - b.id; });

    var counter = $("[data-users-count]");
    if (counter) counter.textContent = users.length;

    if (!users.length) {
      body.innerHTML =
        '<tr><td colspan="7"><div class="empty" style="padding:var(--sp-5) 0">' +
        '<svg class="i"><use href="#i-inbox"></use></svg><p>Никого не найдено.</p></div></td></tr>';
      return;
    }

    body.innerHTML = users.map(function (u) {
      var isAdmin = u.role === "admin";
      var subCell;
      if (u.lifetime) subCell = '<span class="mono">Навсегда</span>';
      else if (u.subUntil && u.subUntil > Date.now()) {
        subCell = '<span class="mono">' + S.fmtShort(u.subUntil) + "</span> " +
                  '<small class="text-dim">(' + Math.ceil((u.subUntil - Date.now()) / 86400000) + " дн.)</small>";
      } else if (u.subUntil) {
        subCell = '<span class="text-dim mono">Истекла ' + S.fmtShort(u.subUntil) + "</span>";
      } else {
        subCell = '<span class="text-dim">Нет</span>';
      }

      var actions = [];
      if (!isAdmin) {
        actions.push('<button class="btn btn--ghost btn--xs" data-act="grant" data-login="' + esc(u.login) + '" data-days="7">+7д</button>');
        actions.push('<button class="btn btn--ghost btn--xs" data-act="grant" data-login="' + esc(u.login) + '" data-days="30">+30д</button>');
        actions.push('<button class="btn btn--ghost btn--xs" data-act="custom" data-login="' + esc(u.login) + '">Дни…</button>');
        actions.push('<button class="btn btn--quiet btn--xs" data-act="revoke" data-login="' + esc(u.login) + '">Снять</button>');
        actions.push(u.banned
          ? '<button class="btn btn--ghost btn--xs" data-act="unban" data-login="' + esc(u.login) + '">Разбан</button>'
          : '<button class="btn btn--danger btn--xs" data-act="ban" data-login="' + esc(u.login) + '">Бан</button>');
      } else {
        actions.push('<span class="badge badge--ok">Это вы · админ</span>');
      }

      return (
        "<tr>" +
        '<td class="mono text-dim">' + u.id + "</td>" +
        '<td><strong>' + esc(u.login) + "</strong></td>" +
        '<td class="text-muted cell-ellipsis">' + esc(u.email) + "</td>" +
        '<td class="mono text-dim">' + esc(u.lastIp || "—") + "</td>" +
        "<td>" + subCell + "</td>" +
        "<td>" + subBadge(u) + "</td>" +
        '<td><div class="tbl-actions">' + actions.join("") + "</div></td>" +
        "</tr>"
      );
    }).join("");
  }

  function bindUsers() {
    var search = $("#userSearch");
    if (search) {
      search.addEventListener("input", function () {
        userQuery = search.value;
        renderUsers();
      });
    }

    var body = $("[data-users-body]");
    if (!body) return;
    body.addEventListener("click", async function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn || btn.disabled) return;
      btn.disabled = true;

      var login = btn.dataset.login;
      var act = btn.dataset.act;
      var res, msg;

      try {
        if (act === "grant") {
          res = await S.grant(login, parseInt(btn.dataset.days, 10));
          msg = login + ": подписка продлена";
        } else if (act === "revoke") {
          res = await S.revoke(login);
          msg = login + ": подписка отозвана";
        } else if (act === "ban") {
          res = await S.ban(login, "Нарушение правил");
          msg = login + ": аккаунт заблокирован";
        } else if (act === "unban") {
          res = await S.unban(login);
          msg = login + ": блокировка снята";
        } else if (act === "custom") {
          var days = prompt("Сколько дней подписки выдать «" + login + "»?", "14");
          if (days == null) return;
          res = await S.grant(login, parseInt(days, 10));
          if (res.ok) toast(login + ": выдано " + parseInt(days, 10) + " дн. подписки");
        }

        if (res && !res.ok && act !== "custom") toast(res.error || "Не получилось", "bad");
        else if (res && res.ok && act !== "custom" && msg) toast(msg);
        await renderAll();
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ keys */
  function planLabel(code) {
    return S.PLANS[code] ? S.PLANS[code].label : code;
  }

  async function renderKeys() {
    var body = $("[data-keys-body]");
    if (!body) return;
    var keys = await S.keysList();

    var emptyEl = $("[data-keys-empty]");
    var tableEl = $("[data-keys-table]");
    var counter = $("[data-keys-count]");
    if (counter) counter.textContent = keys.length;
    if (emptyEl) emptyEl.hidden = keys.length > 0;
    if (tableEl) tableEl.hidden = keys.length === 0;

    body.innerHTML = keys.map(function (k) {
      var used = !!k.usedBy;
      return (
        "<tr>" +
        '<td class="mono">' + k.code + "</td>" +
        "<td>" + esc(planLabel(k.plan)) + "</td>" +
        "<td>" + (used ? '<span class="badge badge--warn">Использован</span>' : '<span class="badge badge--ok">Свободен</span>') + "</td>" +
        '<td class="text-muted">' + (used ? esc(k.usedBy) : "—") + "</td>" +
        '<td class="mono text-dim">' + S.fmtDateTime(k.createdAt) + "</td>" +
        '<td><div class="tbl-actions">' +
        '<button class="btn btn--ghost btn--sm" data-key-copy="' + k.code + '" aria-label="Скопировать ключ"><svg class="i"><use href="#i-copy"></use></svg></button>' +
        '<button class="btn btn--danger btn--sm" data-key-del="' + k.code + '" aria-label="Удалить ключ"><svg class="i"><use href="#i-close"></use></svg></button>' +
        "</div></td>" +
        "</tr>"
      );
    }).join("");
  }

  function bindKeys() {
    var seg = $("[data-plan-seg]");
    if (seg) {
      seg.addEventListener("click", function (e) {
        var btn = e.target.closest(".seg__btn");
        if (!btn) return;
        $$(".seg__btn", seg).forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-pressed", String(on));
        });
      });
    }

    var form = $('form[data-keys-generate]');
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var planBtn = $(".seg__btn.is-on", seg);
        var plan = planBtn ? planBtn.dataset.value : "month";
        var count = parseInt($("#keyCount").value, 10) || 1;
        count = Math.max(1, Math.min(count, 50));

        var made = await S.makeKeys(plan, count);
        if (made.length) toast("Создано ключей: " + made.length + " («" + planLabel(plan) + "»)");
        else toast("Не удалось создать ключи. Вы вошли как админ?", "bad");
        await renderKeys();
        await renderStats();
      });
    }

    var body = $("[data-keys-body]");
    if (!body) return;
    body.addEventListener("click", async function (e) {
      var cp = e.target.closest("button[data-key-copy]");
      if (cp) { copyKey(cp.dataset.keyCopy); return; }

      var del = e.target.closest("button[data-key-del]");
      if (del) {
        del.disabled = true;
        if (await S.removeKey(del.dataset.keyDel)) {
          toast("Ключ удалён");
          await renderKeys();
          await renderStats();
        } else {
          toast("Ключ не найден", "bad");
          del.disabled = false;
        }
      }
    });
  }

  /* ---------------------------------------------------------------- промо */
  async function renderPromos() {
    var body = $("[data-promos-body]");
    if (!body) return;
    var promos = await S.promosList();

    var emptyEl = $("[data-promos-empty]");
    var tableEl = $("[data-promos-table]");
    var counter = $("[data-promos-count]");
    if (counter) counter.textContent = promos.length;
    if (emptyEl) emptyEl.hidden = promos.length > 0;
    if (tableEl) tableEl.hidden = promos.length === 0;

    body.innerHTML = promos.map(function (p) {
      return (
        "<tr>" +
        '<td class="mono">' + p.code + "</td>" +
        '<td><span class="badge badge--ok">−' + p.percent + "%</span></td>" +
        '<td class="mono text-dim">' + (p.uses || 0) + "</td>" +
        '<td class="mono text-dim">' + S.fmtDateTime(p.createdAt) + "</td>" +
        '<td><div class="tbl-actions">' +
        '<button class="btn btn--ghost btn--xs" data-promo-copy="' + p.code + '" aria-label="Скопировать"><svg class="i"><use href="#i-copy"></use></svg></button>' +
        '<button class="btn btn--danger btn--xs" data-promo-del="' + p.code + '" aria-label="Удалить"><svg class="i"><use href="#i-close"></use></svg></button>' +
        "</div></td>" +
        "</tr>"
      );
    }).join("");
  }

  function bindPromos() {
    var form = $('form[data-promos-generate]');
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var percent = parseInt($("#promoPercent").value, 10) || 0;
        var count = parseInt($("#promoCount").value, 10) || 1;
        count = Math.max(1, Math.min(count, 50));

        var r = await S.makePromos(percent, count);
        if (r.ok) toast("Создано промокодов: " + r.codes.length + " (−" + percent + "%)");
        else toast("Не удалось создать промокоды", "bad");
        await renderPromos();
      });
    }

    var body = $("[data-promos-body]");
    if (!body) return;
    body.addEventListener("click", async function (e) {
      var cp = e.target.closest("button[data-promo-copy]");
      if (cp) { copyKey(cp.dataset.promoCopy); return; }

      var del = e.target.closest("button[data-promo-del]");
      if (del) {
        del.disabled = true;
        if (await S.removePromo(del.dataset.promoDel)) {
          toast("Промокод удалён");
          await renderPromos();
        } else {
          toast("Не удалось удалить", "bad");
          del.disabled = false;
        }
      }
    });
  }

  /* ---------------------------------------------------------------- logout */
  function bindLogout() {
    $$("[data-admin-logout]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        await S.logout();
        location.replace("/main");
      });
    });
  }

  async function boot() {
    if (!S) return;
    var me = await guard();
    if (!me) return;
    await renderAll();
    bindUsers();
    bindKeys();
    bindPromos();
    bindLogout();
  }

  boot();

  window.addEventListener("storage", function (e) {
    if (e.key === "aethra_token") boot();
  });
})();
