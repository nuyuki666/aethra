/* ==========================================================================
   Aethra — API client (общается с server.js)
   ========================================================================== */
(function () {
  "use strict";

  var TOKEN_KEY = "aethra_token";

  var PLANS = {
    week: { label: "Неделя", days: 7 },
    month: { label: "Месяц", days: 30 },
    life: { label: "Навсегда", days: null }
  };

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function setToken(token, remember) {
    clearToken();
    try {
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (e) {}
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  var offlineNotified = false;

  async function api(path, body, method) {
    var options = {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" }
    };
    var t = getToken();
    if (t) options.headers.Authorization = "Bearer " + t;
    if (body !== undefined) options.body = JSON.stringify(body);

    var res;
    try {
      res = await fetch("/api" + path, options);
    } catch (e) {
      if (!offlineNotified) {
        offlineNotified = true;
        try { window.dispatchEvent(new CustomEvent("aethra:offline")); } catch (err) {}
      }
      return { ok: false, error: "Сервер недоступен. Если включен VPN/прокси — отключите его для этого сайта и обновите страницу" };
    }

    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var out = data && typeof data === "object"
        ? Object.assign({}, data)
        : { ok: false, error: "Ошибка сервера (" + res.status + ")" };
      out.status = res.status;
      return out;
    }
    if (data && typeof data === "object") data.status = res.status;
    return data;
  }

  function fmtDateTime(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function fmtShort(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  window.AethraStore = {
    PLANS: PLANS,
    fmtDateTime: fmtDateTime,
    fmtShort: fmtShort,
    hasToken: getToken,

    register: async function (login, email, pass, turnstile, captchaId, captchaAnswer) {
      var r = await api("/register", {
        login: login,
        email: email,
        password: pass,
        turnstile: turnstile || "",
        captchaId: captchaId || "",
        captchaAnswer: captchaAnswer || ""
      });
      if (r.ok && r.token) setToken(r.token, true);
      return r;
    },

    authenticate: async function (q, pass, remember) {
      var r = await api("/login", { login: q, password: pass });
      if (r.ok && r.token) setToken(r.token, !!remember);
      return r;
    },

    current: async function () {
      if (!getToken()) return null;
      var r = await api("/me");
      if (r.status === 401) clearToken();
      return r.ok ? r.user : null;
    },

    logout: async function () {
      await api("/logout", {});
      clearToken();
    },

    redeem: function (code) {
      return api("/redeem", { code: code });
    },

    chatGet: async function (after) {
      return api("/chat?after=" + (parseInt(after, 10) || 0));
    },
    chatSend: function (text) {
      return api("/chat", { text: text });
    },

    changePassword: function (currentPassword, newPassword) {
      return api("/password", { currentPassword: currentPassword, newPassword: newPassword });
    },

    setAvatar: function (dataUrl) {
      return api("/avatar", { dataUrl: dataUrl });
    },

    promoCheck: function (code) {
      return api("/promo/check", { code: code });
    },
    promoUse: function (code) {
      return api("/promo/use", { code: code });
    },

    loaderInfo: function () {
      return api("/loader/info");
    },
    hwidReset: function () {
      return api("/hwid/reset", {});
    },

    promosList: async function () {
      var r = await api("/admin/promos");
      return r && r.ok ? r.promos : [];
    },
    makePromos: async function (percent, count, maxUses) {
      var r = await api("/admin/promos", { percent: percent, count: parseInt(count, 10), maxUses: parseInt(maxUses, 10) || 0 });
      return r && r.ok ? r : { ok: false, codes: [] };
    },
    removePromo: async function (code) {
      var r = await api("/admin/promos/delete", { code: code });
      return !!(r && r.ok);
    },

    grant: async function (login, days) {
      return api("/admin/grant", { login: login, days: days == null ? null : parseInt(days, 10) });
    },
    revoke: function (login) {
      return api("/admin/revoke", { login: login });
    },
    ban: function (login, reason) {
      return api("/admin/ban", { login: login, reason: reason || "" });
    },
    unban: function (login) {
      return api("/admin/unban", { login: login });
    },

    makeKeys: async function (plan, count, maxUses, days) {
      var r = await api("/admin/keys", {
        plan: plan,
        count: parseInt(count, 10),
        maxUses: parseInt(maxUses, 10) || 1,
        days: parseInt(days, 10) || 0
      });
      return r && r.ok ? { ok: true, codes: r.codes } : { ok: false, error: (r && r.error) || "Ошибка" };
    },
    removeKey: async function (code) {
      var r = await api("/admin/keys/delete", { code: code });
      return !!(r && r.ok);
    },
    keysList: async function () {
      var r = await api("/admin/keys");
      return r && r.ok ? r.keys : [];
    },

    users: async function () {
      var r = await api("/admin/users");
      return r && r.ok ? r.users : [];
    },
    stats: async function () {
      var r = await api("/admin/stats");
      return r && r.ok
        ? r.stats
        : { users: 0, subs: 0, bans: 0, keys: 0 };
    }
  };
})();
