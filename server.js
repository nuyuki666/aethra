"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createStore } = require("./storage");

const PORT = process.env.PORT || 5177;
const DAY = 86400000;
const ADMIN_LOGIN = "elyww";
const PLANS = {
  week: { label: "Неделя", days: 7 },
  month: { label: "Месяц", days: 30 },
  life: { label: "Навсегда", days: null }
};
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LOGIN_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pass), salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPass(pass, stored) {
  try {
    const [salt, hash] = String(stored).split(":");
    const check = crypto.scryptSync(String(pass), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
  } catch (e) {
    return false;
  }
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function keyCode() {
  function block(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
    return s;
  }
  return "AETH-" + block(4) + "-" + block(4);
}

function bad(res, error, extra) {
  return res.status(400).json(Object.assign({ ok: false, error }, extra || {}));
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "");
  const first = fwd.split(",")[0].trim();
  if (first) return first;
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
}

async function ensureAdmin(store) {
  let admin = await store.getUserByLogin(ADMIN_LOGIN);
  if (!admin) {
    admin = await store.createUser({
      login: ADMIN_LOGIN,
      email: "elyww@aethra.local",
      passHash: hashPass(process.env.ADMIN_PASS || "elyww123"),
      role: "admin",
      banned: false,
      banReason: "",
      lifetime: true,
      subUntil: null,
      regAt: Date.now(),
      lastLogin: null
    });
    console.log("[seed] Создан администратор: " + ADMIN_LOGIN);
  } else if (admin.role !== "admin") {
    admin = await store.updateUser(ADMIN_LOGIN, { role: "admin", lifetime: true });
  }
  return admin;
}

function subActive(u) {
  return !u.banned && (u.lifetime || (u.subUntil && u.subUntil > Date.now()));
}

async function main() {
  const store = await createStore();
  await ensureAdmin(store);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  /* ------------------------------------------------------------ auth utils */
  async function currentUser(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (!m) return null;
    return store.getUserByToken(m[1].trim());
  }

  function requireAuth(handler) {
    return async (req, res) => {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ ok: false, error: "Нужно войти в аккаунт" });
      req.user = user;
      await handler(req, res);
    };
  }

  function requireAdmin(handler) {
    return requireAuth(async (req, res) => {
      if (req.user.role !== "admin") {
        return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
      }
      await handler(req, res);
    });
  }

  /* ---------------------------------------------------------------- public */
  app.post("/api/register", async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "").trim();
      const email = String((req.body && req.body.email) || "").trim();
      const password = String((req.body && req.body.password) || "");

      if (!LOGIN_RE.test(login)) return bad(res, "Логин: латиница/цифры/_ . - от 3 символов");
      if (!EMAIL_RE.test(email)) return bad(res, "Введите корректный e-mail");
      if (password.length < 8 || password.length > 128) return bad(res, "Пароль: минимум 8 символов");

      const human = await verifyTurnstile(String((req.body && req.body.turnstile) || ""), clientIp(req));
      if (!human) return bad(res, "Пройдите проверку Cloudflare");

      if (await store.getUserByLoginOrEmail(login)) return bad(res, "Такой логин уже занят");
      if ((await store.getAllUsers()).some(u => u.email.toLowerCase() === email.toLowerCase()))
        return bad(res, "Этот e-mail уже используется");

      const user = await store.createUser({
        login,
        email,
        passHash: hashPass(password),
        role: "default",
        banned: false,
        banReason: "",
        lifetime: false,
        subUntil: null,
        regAt: Date.now(),
        lastLogin: Date.now(),
        lastIp: clientIp(req)
      });

      const token = newToken();
      await store.createSession(token, user.login);
      res.json({ ok: true, token, user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const q = String((req.body && req.body.login) || "").trim();
      const password = String((req.body && req.body.password) || "");
      const hash = await store.getPasswordHash(q);

      if (!hash || !verifyPass(password, hash)) return bad(res, "Неверный логин или пароль");

      const user = await store.getUserByLoginOrEmail(q);
      if (!user) return bad(res, "Неверный логин или пароль");
      if (user.banned) {
        return res.status(403).json({ ok: false, banned: true, error: "Аккаунт заблокирован администратором" });
      }

      await store.updateUser(user.login, { lastLogin: Date.now(), lastIp: clientIp(req) });
      const token = newToken();
      await store.createSession(token, user.login);
      res.json({ ok: true, token, user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  app.get("/api/me", requireAuth(async (req, res) => {
    res.json({ ok: true, user: req.user });
  }));

  app.post("/api/logout", requireAuth(async (req, res) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (m) await store.deleteSession(m[1].trim());
    res.json({ ok: true });
  }));

  app.post("/api/redeem", requireAuth(async (req, res) => {
    try {
      const code = String((req.body && req.body.code) || "").trim().toUpperCase();
      if (!code) return bad(res, "Введите ключ");

      if (req.user.banned) return bad(res, "Аккаунт заблокирован");
      if (req.user.lifetime) return bad(res, "У вас уже пожизненный доступ");

      const key = await store.getKey(code);
      if (!key) return bad(res, "Ключ не найден");
      if (key.usedBy) return bad(res, "Ключ уже активирован");

      const plan = PLANS[key.plan];
      if (!plan) return bad(res, "Неизвестный тариф ключа");

      const consumed = await store.consumeKey(code, req.user.login);
      if (!consumed) return bad(res, "Ключ уже активирован");

      if (plan.days == null) {
        await store.updateUser(req.user.login, { lifetime: true, subUntil: null });
        await store.addHistory(req.user.login, "Активирован ключ «Навсегда»");
      } else {
        const base = Math.max(req.user.subUntil || 0, Date.now());
        await store.updateUser(req.user.login, { subUntil: base + plan.days * DAY });
        await store.addHistory(req.user.login, `Активирован ключ «${plan.label}» (+${plan.days} дн.)`);
      }

      const user = await store.getUserByLogin(req.user.login);
      res.json({ ok: true, plan, user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/password", requireAuth(async (req, res) => {
    try {
      const cur = String((req.body && req.body.currentPassword) || "");
      const next = String((req.body && req.body.newPassword) || "");

      if (next.length < 8 || next.length > 128) return bad(res, "Новый пароль: минимум 8 символов");

      const hash = await store.getPasswordHash(req.user.login);
      if (!hash || !verifyPass(cur, hash)) return bad(res, "Текущий пароль неверный");
      if (cur === next) return bad(res, "Новый пароль совпадает со старым");

      await store.updateUser(req.user.login, { passHash: hashPass(next) });
      await store.addHistory(req.user.login, "Пароль изменён через профиль");
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* --------------------------------------------------------- public stats */
  app.get("/api/public-stats", async (req, res) => {
    try {
      const users = await store.getAllUsers();
      const players = users.filter(u => u.role !== "admin" && !u.banned && subActive(u)).length;
      res.json({ ok: true, players });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, players: 0 });
    }
  });

  /* --------------------------------------------------------- turnstile */
  async function verifyTurnstile(token, ip) {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return true;
    if (!token) return false;
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip || "" })
      });
      const d = await r.json();
      return !!d.success;
    } catch (e) {
      console.error("turnstile verify failed:", e);
      return false;
    }
  }

  app.get("/api/config", (req, res) => {
    res.json({ ok: true, turnstileSiteKey: process.env.TURNSTILE_SITEKEY || "" });
  });

  /* ----------------------------------------------------- avatar & misc */
  app.post("/api/avatar", requireAuth(async (req, res) => {
    try {
      const dataUrl = String((req.body && req.body.dataUrl) || "");
      if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
        return bad(res, "Неверный формат изображения");
      }
      if (dataUrl.length > 300000) return bad(res, "Картинка слишком большая");
      await store.updateUser(req.user.login, { avatar: dataUrl });
      res.json({ ok: true, avatar: dataUrl });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* ------------------------------------------------------------------ chat */
  app.get("/api/chat", async (req, res) => {
    try {
      const after = parseInt(req.query.after, 10) || 0;
      res.json({ ok: true, messages: await store.getChatMessages(after) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  app.post("/api/chat", requireAuth(async (req, res) => {
    try {
      const text = String((req.body && req.body.text) || "").trim().slice(0, 240);
      if (!text) return bad(res, "Пустое сообщение");
      const msg = await store.addChatMessage(req.user.login, text);
      res.json({ ok: true, message: msg });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* ----------------------------------------------------------------- admin */
  app.get("/api/admin/users", requireAdmin(async (req, res) => {
    res.json({ ok: true, users: await store.getAllUsers() });
  }));

  app.get("/api/admin/keys", requireAdmin(async (req, res) => {
    res.json({ ok: true, keys: await store.getAllKeys() });
  }));

  app.get("/api/admin/stats", requireAdmin(async (req, res) => {
    const users = await store.getAllUsers();
    const keys = await store.getAllKeys();
    const stats = {
      users: users.length,
      subs: users.filter(u => !u.banned && subActive(u)).length,
      bans: users.filter(u => u.banned).length,
      keys: keys.filter(k => !k.usedBy).length
    };
    res.json({ ok: true, stats });
  }));

  app.post("/api/admin/grant", requireAdmin(async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "");
      const user = await store.getUserByLogin(login);
      if (!user) return bad(res, "Пользователь не найден");
      if (user.lifetime) return bad(res, "У пользователя пожизненный доступ");

      if (req.body.days == null) {
        await store.updateUser(login, { lifetime: true, subUntil: null });
        await store.addHistory(login, "Выдан пожизненный доступ (администратором)");
      } else {
        const days = parseInt(req.body.days, 10);
        if (!days || days < 1 || days > 3650) return bad(res, "Неверное количество дней");
        const base = Math.max(user.subUntil || 0, Date.now());
        await store.updateUser(login, { subUntil: base + days * DAY });
        await store.addHistory(login, `Выдано ${days} дн. подписки (администратором)`);
      }
      res.json({ ok: true, user: await store.getUserByLogin(login) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/revoke", requireAdmin(async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "");
      const user = await store.getUserByLogin(login);
      if (!user) return bad(res, "Пользователь не найден");
      if (!user.lifetime && !(user.subUntil > Date.now())) return bad(res, "Активной подписки нет");

      await store.updateUser(login, { lifetime: false, subUntil: null });
      await store.addHistory(login, "Подписка отозвана администратором");
      res.json({ ok: true, user: await store.getUserByLogin(login) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/ban", requireAdmin(async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "");
      const reason = String((req.body && req.body.reason) || "").slice(0, 200);
      const user = await store.getUserByLogin(login);
      if (!user) return bad(res, "Пользователь не найден");
      if (user.role === "admin") return bad(res, "Администратора нельзя забанить");

      await store.updateUser(login, { banned: true, banReason: reason });
      await store.addHistory(login, "Аккаунт заблокирован" + (reason ? `: ${reason}` : ""));
      res.json({ ok: true, user: await store.getUserByLogin(login) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/unban", requireAdmin(async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "");
      const user = await store.getUserByLogin(login);
      if (!user) return bad(res, "Пользователь не найден");

      await store.updateUser(login, { banned: false, banReason: "" });
      await store.addHistory(login, "Блокировка снята");
      res.json({ ok: true, user: await store.getUserByLogin(login) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/keys", requireAdmin(async (req, res) => {
    try {
      const planCode = String((req.body && req.body.plan) || "");
      const count = parseInt((req.body && req.body.count), 10);
      if (!PLANS[planCode]) return bad(res, "Неизвестный тариф");
      if (!count || count < 1 || count > 50) return bad(res, "Количество: от 1 до 50");

      const codes = [];
      for (let i = 0; i < count; i++) codes.push(keyCode());
      await store.upsertKeys(codes.map(code => ({
        code,
        plan: planCode,
        createdAt: Date.now(),
        createdBy: req.user.login
      })));
      res.json({ ok: true, codes, plan: PLANS[planCode] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/keys/delete", requireAdmin(async (req, res) => {
    try {
      const code = String((req.body && req.body.code) || "");
      const removed = await store.deleteKey(code);
      if (!removed) return bad(res, "Ключ не найден");
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* ---------------------------------------------------------------- static */
  app.get("/main", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/index.html", (req, res) => res.redirect(301, "/main"));

  app.use(express.static(__dirname, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (/\.html?$/i.test(filePath) || /\.(js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ ok: false, error: "Не найдено" });
    res.redirect("/");
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ ok: false, error: "Ошибка сервера" });
  });

  app.listen(PORT, () => {
    console.log(`Aethra server запущен: http://localhost:${PORT}`);
  });
}

main().catch(e => {
  console.error("Не удалось запустить сервер:", e);
  process.exit(1);
});
