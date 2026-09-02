"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
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
const CAPTCHA_TTL = 10 * 60 * 1000;
const captchaChallenges = new Map();

function cleanupCaptchaChallenges() {
  const now = Date.now();
  for (const [id, challenge] of captchaChallenges) {
    if (challenge.expiresAt <= now) captchaChallenges.delete(id);
  }
  while (captchaChallenges.size > 5000) {
    const first = captchaChallenges.keys().next();
    if (first.done) break;
    captchaChallenges.delete(first.value);
  }
}

function createCaptchaChallenge() {
  cleanupCaptchaChallenges();
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const multiply = crypto.randomInt(0, 3) === 0;
  const answer = multiply ? a * b : a + b;
  const id = crypto.randomBytes(18).toString("hex");
  captchaChallenges.set(id, { answer, expiresAt: Date.now() + CAPTCHA_TTL });
  return { id, question: a + (multiply ? " × " : " + ") + b + " = ?" };
}

function verifyCaptchaChallenge(id, answer) {
  cleanupCaptchaChallenges();
  const challenge = captchaChallenges.get(String(id || ""));
  captchaChallenges.delete(String(id || ""));
  if (!challenge || challenge.expiresAt <= Date.now()) return false;
  const expected = Buffer.from(String(challenge.answer));
  const actual = Buffer.from(String(answer || "").trim());
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET && process.env.TURNSTILE_SITEKEY);
}

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

function promoCode() {
  let s = "";
  for (let i = 0; i < 5; i++) s += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
  return "PROMO-" + s;
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
  app.use(cookieParser());
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

      const human = turnstileConfigured()
        ? await verifyTurnstile(String((req.body && req.body.turnstile) || ""), clientIp(req))
        : verifyCaptchaChallenge(
            String((req.body && req.body.captchaId) || ""),
            String((req.body && req.body.captchaAnswer) || "")
          );
      if (!human) return bad(res, turnstileConfigured() ? "Пройдите проверку Cloudflare" : "Введите правильный ответ капчи");

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

      const key = await store.getKey(code);
      if (!key) return bad(res, "Ключ не найден");
      
      const product = key.product || "cs2";
      const maxUses = key.maxUses || 1;
      if ((key.uses || 0) >= maxUses) return bad(res, "Лимит активаций ключа исчерпан");
      if (key.usedBy && maxUses === 1) return bad(res, "Ключ уже активирован");

      // Проверка что у пользователя ещё нет lifetime для этого товара
      const me = req.user;
      if (me.lifetime) {
        // Если у пользователя есть старая lifetime подписка, разрешаем только если ключ на другой товар
        // Но мы не знаем на какой товар была старая lifetime, поэтому просто запрещаем
        return bad(res, "У вас уже пожизненный доступ");
      }

      let days = null;
      let label = "";
      if (key.plan === "custom") {
        days = parseInt(key.days, 10);
        if (!days || days < 1) return bad(res, "У ключа не указан срок");
        label = "Своё (" + days + " дн.)";
      } else {
        const plan = PLANS[key.plan];
        if (!plan) return bad(res, "Неизвестный тариф ключа");
        days = plan.days;
        label = plan.label;
      }

      const consumed = await store.consumeKey(code, me.login);
      if (!consumed) return bad(res, "Ключ уже активирован");

      const productNames = { cs2: "CS2", minecraft: "Minecraft", visual: "Visual" };
      const productLabel = productNames[product] || product;

      if (days == null) {
        // Lifetime для конкретного товара - пока ставим старую lifetime (TODO: можно сделать отдельно)
        await store.updateUser(me.login, { lifetime: true, subUntil: null });
        await store.addHistory(me.login, "Активирован ключ «Навсегда» (" + productLabel + ")");
      } else {
        // Продлеваем подписку на конкретный товар
        const subField = "sub_" + product;
        let currentSub = 0;
        if (product === "cs2") currentSub = me.subCs2 || 0;
        else if (product === "minecraft") currentSub = me.subMinecraft || 0;
        else if (product === "visual") currentSub = me.subVisual || 0;
        
        const base = Math.max(currentSub, Date.now());
        const newSub = base + days * DAY;
        
        const updates = {};
        updates[subField] = newSub;
        
        await store.updateUser(me.login, updates);
        await store.addHistory(me.login, "Активирован ключ «" + label + "» (" + productLabel + ", +" + days + " дн.)");
      }

      const user = await store.getUserByLogin(me.login);
      res.json({ ok: true, plan: { label, days }, user });
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
      const keys = await store.getAllKeys();
      const players = users.filter(u => u.role !== "admin" && !u.banned && subActive(u)).length;
      
      // Покупки за последние 30 дней
      const monthAgo = Date.now() - 30 * DAY;
      const purchases = keys.filter(k => k.redeemedAt && k.redeemedAt >= monthAgo).length;
      
      res.json({ ok: true, players, purchases });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, players: 0, purchases: 0 });
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
    res.json({
      ok: true,
      turnstileSiteKey: process.env.TURNSTILE_SITEKEY || "",
      captcha: !turnstileConfigured() ? createCaptchaChallenge() : null
    });
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

  /* ------------------------------------------------------------- промокоды */
  app.post("/api/promo/check", requireAuth(async (req, res) => {
    try {
      const code = String((req.body && req.body.code) || "");
      const product = String((req.body && req.body.product) || "");
      const p = await store.getPromo(code);
      if (!p) return bad(res, "Промокод не найден или больше не активен");
      
      // Проверка что промокод подходит для этого товара
      if (p.product && p.product !== "all" && p.product !== product) {
        return bad(res, "Этот промокод не действует на выбранный товар");
      }
      
      res.json({ ok: true, percent: p.percent });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/promo/use", requireAuth(async (req, res) => {
    try {
      await store.incrPromoUse(String((req.body && req.body.code) || ""));
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.get("/api/admin/promos", requireAdmin(async (req, res) => {
    res.json({ ok: true, promos: await store.getAllPromos() });
  }));

  app.post("/api/admin/promos", requireAdmin(async (req, res) => {
    try {
      const percent = parseInt((req.body && req.body.percent), 10);
      const count = parseInt((req.body && req.body.count), 10);
      const maxUses = parseInt((req.body && req.body.maxUses), 10) || 0;
      const product = String((req.body && req.body.product) || "all");
      if (!percent || percent < 1 || percent > 90) return bad(res, "Скидка: от 1 до 90%");
      if (!count || count < 1 || count > 50) return bad(res, "Количество: от 1 до 50");
      if (maxUses < 0 || maxUses > 1000) return bad(res, "Лимит активаций: 0 (безлимит) или 1–1000");
      if (!["all", "cs2", "minecraft", "visual"].includes(product)) return bad(res, "Неизвестный товар");

      const codes = [];
      for (let i = 0; i < count; i++) codes.push(promoCode());
      await store.upsertPromos(codes.map(code => ({
        code,
        percent,
        maxUses,
        product,
        createdAt: Date.now(),
        createdBy: req.user.login
      })));
      res.json({ ok: true, codes, percent });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.post("/api/admin/promos/delete", requireAdmin(async (req, res) => {
    try {
      const removed = await store.deletePromo(String((req.body && req.body.code) || ""));
      if (!removed) return bad(res, "Промокод не найден");
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* ------------------------------------------------------ лоадер и HWID */
  const HWID_RESET_LIMIT = 2;
  const LOADER_FILE = path.join(__dirname, "downloads", "AethraLoader.exe");

  function maskHwid(h) {
    if (!h) return "";
    return h.length > 12 ? h.slice(0, 6) + "…" + h.slice(-4) : h;
  }

  app.post("/api/loader/login", async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "").trim();
      const password = String((req.body && req.body.password) || "");
      const hwid = String((req.body && req.body.hwid) || "").trim().slice(0, 80);

      const hash = await store.getPasswordHash(login);
      if (!hash || !verifyPass(password, hash)) {
        return res.status(401).json({ ok: false, error: "Неверный логин или пароль" });
      }
      const user = await store.getUserByLoginOrEmail(login);
      if (!user) return res.status(401).json({ ok: false, error: "Неверный логин или пароль" });
      if (user.banned) return res.status(403).json({ ok: false, error: "Аккаунт заблокирован" });
      if (!subActive(user)) return res.status(403).json({ ok: false, error: "Нет активной подписки. Купите ключ на сайте" });

      if (!user.hwid) {
        await store.updateUser(user.login, { hwid });
        await store.addHistory(user.login, "HWID привязан через лоадер");
      } else if (user.hwid !== hwid) {
        return res.status(403).json({
          ok: false,
          hwidMismatch: true,
          error: "Подписка привязана к другому ПК. Сбросьте HWID в профиле на сайте"
        });
      }

      await store.updateUser(user.login, { lastLogin: Date.now(), lastIp: clientIp(req) });
      const token = crypto.randomBytes(32).toString("hex");
      await store.createSession(token, user.login);
      
      // Проверяем активные подписки на продукты
      const now = Date.now();
      const products = {
        cs2: user.lifetime || (user.subCs2 && user.subCs2 > now),
        minecraft: user.lifetime || (user.subMinecraft && user.subMinecraft > now),
        visual: user.lifetime || (user.subVisual && user.subVisual > now)
      };
      
      res.json({
        ok: true,
        token,
        login: user.login,
        avatar: user.avatar || "",
        lifetime: !!user.lifetime,
        subUntil: user.subUntil,
        till: user.lifetime ? "Lifetime" : S_fmtShort(user.subUntil),
        products: {
          cs2: {
            active: products.cs2,
            till: user.lifetime ? "Lifetime" : (products.cs2 ? S_fmtShort(user.subCs2) : "No access")
          },
          minecraft: {
            active: products.minecraft,
            till: user.lifetime ? "Lifetime" : (products.minecraft ? S_fmtShort(user.subMinecraft) : "No access")
          },
          visual: {
            active: products.visual,
            till: user.lifetime ? "Lifetime" : (products.visual ? S_fmtShort(user.subVisual) : "No access")
          }
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  function S_fmtShort(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const p = n => (n < 10 ? "0" : "") + n;
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }

  app.post("/api/loader/restore", async (req, res) => {
    try {
      const token = String((req.body && req.body.token) || "");
      const hwid = String((req.body && req.body.hwid) || "").trim().slice(0, 80);
      const user = token ? await store.getUserByToken(token) : null;
      if (!user) return res.status(401).json({ ok: false, error: "Сессия истекла" });
      if (user.banned) {
        return res.status(403).json({ ok: false, error: "Аккаунт заблокирован" });
      }
      if (!subActive(user)) return res.status(403).json({ ok: false, error: "Нет активной подписки" });
      if (user.hwid && user.hwid !== hwid) {
        return res.status(403).json({ ok: false, hwidMismatch: true, error: "HWID не совпадает" });
      }
      if (!user.hwid && hwid) {
        await store.updateUser(user.login, { hwid });
        await store.addHistory(user.login, "HWID привязан через лоадер");
      }
      await store.updateUser(user.login, { lastLogin: Date.now(), lastIp: clientIp(req) });

      res.json({
        ok: true,
        token,
        login: user.login,
        avatar: user.avatar || "",
        lifetime: !!user.lifetime,
        subUntil: user.subUntil,
        till: user.lifetime ? "Lifetime" : S_fmtShort(user.subUntil)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  app.get("/api/loader/info", requireAuth(async (req, res) => {
    const u = req.user;
    res.json({
      ok: true,
      hwid: u.hwid || "",
      hwidMasked: u.hwid ? maskHwid(u.hwid) : "",
      resetsLeft: Math.max(0, HWID_RESET_LIMIT - (u.hwidResets || 0)),
      resetLimit: HWID_RESET_LIMIT,
      subActive: subActive(u),
      lifetime: !!u.lifetime,
      subUntil: u.subUntil
    });
  }));

  app.post("/api/hwid/reset", requireAuth(async (req, res) => {
    try {
      const u = req.user;
      const used = u.hwidResets || 0;
      if (used >= HWID_RESET_LIMIT) return bad(res, "Лимит сбросов исчерпан. Напишите в поддержку");
      if (!u.hwid) return bad(res, "HWID не привязан");
      await store.updateUser(u.login, { hwid: "", hwidResets: used + 1 });
      await store.addHistory(u.login, "Сброс привязки HWID (" + (used + 1) + "/" + HWID_RESET_LIMIT + ")");
      res.json({
        ok: true,
        resetsLeft: HWID_RESET_LIMIT - used - 1,
        resetLimit: HWID_RESET_LIMIT
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  app.get("/api/download/loader", async (req, res) => {
    try {
      const token = String(req.query.t || "");
      const user = token ? await store.getUserByToken(token) : null;
      if (!user) return res.status(401).json({ ok: false, error: "Нужно войти в аккаунт" });
      if (!subActive(user)) return res.status(403).json({ ok: false, error: "Нужна активная подписка" });
      if (!fs.existsSync(LOADER_FILE)) {
        return res.status(404).json({ ok: false, error: "Файл лоадера пока не загружен администратором" });
      }
      res.download(LOADER_FILE, "AethraLoader.exe");
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

  app.get("/api/avatars", async (req, res) => {
    try {
      const logins = String(req.query.logins || "")
        .split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
      const avatars = {};
      for (const l of logins) {
        const u = await store.getUserByLogin(l);
        if (u && u.avatar) avatars[u.login] = u.avatar;
      }
      res.json({ ok: true, avatars });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  });

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
      const product = String((req.body && req.body.product) || "cs2");
      const count = parseInt((req.body && req.body.count), 10);
      const maxUses = parseInt((req.body && req.body.maxUses), 10) || 1;
      const days = parseInt((req.body && req.body.days), 10) || 0;
      if (!count || count < 1 || count > 50) return bad(res, "Количество: от 1 до 50");
      if (maxUses < 1 || maxUses > 100) return bad(res, "Активаций на ключ: от 1 до 100");
      if (!["cs2", "minecraft", "visual"].includes(product)) return bad(res, "Неизвестный товар");

      if (planCode === "custom") {
        if (days < 1 || days > 3650) return bad(res, "Срок: от 1 до 3650 дней");
      } else if (!PLANS[planCode]) {
        return bad(res, "Неизвестный тариф");
      }

      const codes = [];
      for (let i = 0; i < count; i++) codes.push(keyCode());
      await store.upsertKeys(codes.map(code => ({
        code,
        plan: planCode,
        product,
        createdAt: Date.now(),
        createdBy: req.user.login,
        maxUses,
        days: planCode === "custom" ? days : null
      })));
      res.json({ ok: true, codes, plan: planCode === "custom" ? { label: "Своё (" + days + " дн.)", days } : PLANS[planCode] });
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

  app.post("/api/admin/create-user", requireAdmin(async (req, res) => {
    try {
      const login = String((req.body && req.body.login) || "").trim();
      const email = String((req.body && req.body.email) || "").trim();
      const password = String((req.body && req.body.password) || "");

      if (!login || login.length < 3 || login.length > 20) {
        return bad(res, "Логин: от 3 до 20 символов");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(login)) {
        return bad(res, "Логин может содержать только латиницу, цифры, _ и -");
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return bad(res, "Некорректный e-mail");
      }
      if (!password || password.length < 6) {
        return bad(res, "Пароль: минимум 6 символов");
      }

      const exists = await store.getUserByLoginOrEmail(login, email);
      if (exists) {
        return bad(res, "Логин или e-mail уже занят");
      }

      const passHash = hashPass(password);
      const user = {
        login,
        email,
        passHash,
        role: "default",
        banned: false,
        banReason: "",
        lifetime: false,
        subUntil: null,
        regAt: Date.now(),
        lastLogin: null
      };

      await store.createUser(user);
      res.json({ ok: true, login });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "Ошибка сервера" });
    }
  }));

  /* ---------------------------------------------------------------- static */
  app.get("/main", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
  app.get("/index.html", (req, res) => res.redirect(301, "/main"));

  // Лоадер доступен всем авторизованным пользователям (проверка подписки внутри лоадера)
  app.use("/loader", async (req, res, next) => {
    try {
      // Проверяем токен из cookie или заголовка
      const token = req.cookies?.token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) {
        return res.status(401).send(`
          <!DOCTYPE html>
          <html lang="ru">
          <head><meta charset="utf-8"><title>Требуется авторизация</title></head>
          <body><h1>Требуется авторизация</h1><p>Войдите в аккаунт для доступа к лоадеру.</p><a href="/login.html">Войти</a></body>
          </html>
        `);
      }

      const user = await store.getUserByToken(token);
      if (!user) {
        return res.status(401).send(`
          <!DOCTYPE html>
          <html lang="ru">
          <head><meta charset="utf-8"><title>Сессия истекла</title></head>
          <body><h1>Сессия истекла</h1><p>Войдите в аккаунт снова.</p><a href="/login.html">Войти</a></body>
          </html>
        `);
      }

      // Пользователь авторизован - лоадер сам проверит подписку
      next();
    } catch (e) {
      console.error(e);
      res.status(500).send("Ошибка сервера");
    }
  });

  app.use("/loader", express.static(path.join(__dirname, "loader"), {
    setHeaders(res, filePath) {
      if (/\.(js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));

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
