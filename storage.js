"use strict";

const fs = require("fs");
const path = require("path");

const HISTORY_LIMIT = 30;

/* ==========================================================================
   FileStore — локальное хранилище (data/aethra.json), работает без БД.
   Используется, когда не задана переменная окружения DATABASE_URL.
   ========================================================================== */
class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { users: [], keys: [], sessions: [], history: {} };
  }

  async init() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.data = Object.assign(this.data, parsed);
    } catch (e) {
      /* новый файл базы */
    }
    ["users", "keys", "sessions"].forEach(k => {
      if (!Array.isArray(this.data[k])) this.data[k] = [];
    });
    if (!Array.isArray(this.data.messages)) this.data.messages = [];
    if (!Array.isArray(this.data.promos)) this.data.promos = [];
    if (!this.data.history || typeof this.data.history !== "object") this.data.history = {};
    this.persist();
    return this;
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  hist(login) {
    return this.data.history[login] || [];
  }
  pub(u) {
    if (!u) return null;
    const { passHash, totpSecret, ...rest } = u;
    rest.history = this.hist(rest.login).slice(0, HISTORY_LIMIT).map(h => ({ at: h.at, label: h.label }));
    return rest;
  }

  findRawByQuery(q) {
    q = String(q || "").toLowerCase();
    return this.data.users.find(
      u => u.login.toLowerCase() === q || String(u.email).toLowerCase() === q
    ) || null;
  }

  async getPasswordHash(q) {
    const u = this.findRawByQuery(q);
    return u ? u.passHash : null;
  }

  async getUserByLoginOrEmail(q) {
    return this.pub(this.findRawByQuery(q));
  }

  async getUserByLogin(login) {
    const l = String(login || "").toLowerCase();
    const u = this.data.users.find(x => x.login.toLowerCase() === l);
    return this.pub(u);
  }

  async createUser(fields) {
    const id = this.data.users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0) + 1;
    const user = Object.assign({ id }, fields);
    this.data.users.push(user);
    this.persist();
    return this.pub(user);
  }

  async updateUser(login, patch) {
    const l = String(login || "").toLowerCase();
    const u = this.data.users.find(x => x.login.toLowerCase() === l);
    if (!u) return null;
    Object.assign(u, patch);
    this.persist();
    return this.pub(u);
  }

  async addHistory(login, label) {
    const h = this.data.history[login] || (this.data.history[login] = []);
    h.unshift({ at: Date.now(), label: String(label) });
    if (h.length > HISTORY_LIMIT) h.length = HISTORY_LIMIT;
    this.persist();
  }

  async createSession(token, login) {
    this.data.sessions.push({ token, login, createdAt: Date.now() });
    if (this.data.sessions.length > 2000) {
      this.data.sessions = this.data.sessions.slice(-1000);
    }
    this.persist();
  }

  async deleteSession(token) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.persist();
  }

  async getUserByToken(token) {
    const s = this.data.sessions.find(x => x.token === token);
    return s ? this.getUserByLogin(s.login) : null;
  }

  async upsertKeys(keys) {
    for (const k of keys) {
      this.data.keys.unshift({
        code: k.code,
        plan: k.plan,
        createdAt: k.createdAt,
        createdBy: k.createdBy,
        usedBy: null,
        usedAt: null
      });
    }
    this.persist();
  }

  async getAllKeys() {
    return this.data.keys.map(k => ({ ...k }));
  }

  async getKey(code) {
    code = String(code || "").toUpperCase();
    return this.data.keys.find(k => k.code === code) || null;
  }

  async consumeKey(code, login) {
    const k = await this.getKey(code);
    if (!k || k.usedBy) return null;
    k.usedBy = login;
    k.usedAt = Date.now();
    this.persist();
    return { ...k };
  }

  async deleteKey(code) {
    const before = this.data.keys.length;
    this.data.keys = this.data.keys.filter(k => k.code !== String(code));
    const removed = this.data.keys.length < before;
    if (removed) this.persist();
    return removed;
  }

  async getAllUsers() {
    return this.data.users.map(u => this.pub(u));
  }

  async getChatMessages(after) {
    return this.data.messages
      .filter(m => m.id > (parseInt(after, 10) || 0))
      .slice(-50)
      .map(m => ({ ...m }));
  }

  async addChatMessage(login, text) {
    const id = this.data.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const msg = { id, login, text: String(text).slice(0, 240), at: Date.now() };
    this.data.messages.push(msg);
    if (this.data.messages.length > 500) this.data.messages = this.data.messages.slice(-300);
    this.persist();
    return msg;
  }

  async upsertPromos(list) {
    for (const p of list) {
      this.data.promos.unshift({
        code: p.code,
        percent: p.percent,
        active: true,
        uses: 0,
        createdAt: p.createdAt,
        createdBy: p.createdBy
      });
    }
    this.persist();
  }

  async getAllPromos() {
    return this.data.promos.map(p => ({ ...p }));
  }

  async getPromo(code) {
    code = String(code || "").toUpperCase();
    const p = this.data.promos.find(x => x.code === code && x.active);
    return p ? { code: p.code, percent: p.percent } : null;
  }

  async incrPromoUse(code) {
    code = String(code || "").toUpperCase();
    const p = this.data.promos.find(x => x.code === code);
    if (!p) return false;
    p.uses = (p.uses || 0) + 1;
    this.persist();
    return true;
  }

  async deletePromo(code) {
    const before = this.data.promos.length;
    this.data.promos = this.data.promos.filter(p => p.code !== String(code));
    const removed = this.data.promos.length < before;
    if (removed) this.persist();
    return removed;
  }
}

/* ==========================================================================
   PgStore — PostgreSQL (Render Postgres / Neon / Supabase и т.п.)
   Включается автоматически, когда задан DATABASE_URL.
   ========================================================================== */
class PgStore {
  constructor(pool) {
    this.pool = pool;
  }

  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      login TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'default',
      banned BOOLEAN NOT NULL DEFAULT FALSE,
      ban_reason TEXT NOT NULL DEFAULT '',
      lifetime BOOLEAN NOT NULL DEFAULT FALSE,
      sub_until BIGINT,
      reg_at BIGINT NOT NULL,
      last_login BIGINT
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS keys (
      code TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      created_by TEXT NOT NULL,
      used_by TEXT,
      used_at BIGINT
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      login TEXT NOT NULL,
      at BIGINT NOT NULL,
      label TEXT NOT NULL
    )`);
    await this.pool.query("CREATE INDEX IF NOT EXISTS idx_history_login ON history (login)");
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      login TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      login TEXT NOT NULL,
      text TEXT NOT NULL,
      at BIGINT NOT NULL
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS promos (
      code TEXT PRIMARY KEY,
      percent INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      uses INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      created_by TEXT NOT NULL
    )`);
    await this.pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT DEFAULT ''");
    await this.pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT ''");
    await this.pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT ''");
    await this.pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE");
    return this;
  }

  mapUser(r) {
    return {
      id: r.id,
      login: r.login,
      email: r.email,
      role: r.role,
      banned: r.banned,
      banReason: r.ban_reason || "",
      lifetime: r.lifetime,
      subUntil: r.sub_until == null ? null : Number(r.sub_until),
      regAt: Number(r.reg_at),
      lastLogin: r.last_login == null ? null : Number(r.last_login),
      lastIp: r.last_ip || "",
      avatar: r.avatar || "",
      totpEnabled: !!r.totp_enabled,
      history: []
    };
  }

  async attachHistory(users) {
    if (!users.length) return users;
    const logins = users.map(u => u.login);
    const res = await this.pool.query(
      "SELECT login, at, label FROM history WHERE login = ANY($1::text[]) ORDER BY at DESC",
      [logins]
    );
    const byLogin = {};
    for (const row of res.rows) {
      (byLogin[row.login] = byLogin[row.login] || []).push({ at: Number(row.at), label: row.label });
    }
    users.forEach(u => {
      u.history = (byLogin[u.login] || []).slice(0, HISTORY_LIMIT);
    });
    return users;
  }

  async _userRows(where, params) {
    const res = await this.pool.query(
      `SELECT * FROM users ${where}`,
      params
    );
    return this.attachHistory(res.rows.map(r => this.mapUser(r)));
  }

  async getPasswordHash(q) {
    const res = await this.pool.query(
      "SELECT pass_hash FROM users WHERE LOWER(login) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1",
      [String(q || "")]
    );
    return res.rows[0] ? res.rows[0].pass_hash : null;
  }

  async getUserByLoginOrEmail(q) {
    const rows = await this._userRows(
      "WHERE LOWER(login) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1",
      [String(q || "")]
    );
    return rows[0] || null;
  }

  async getUserByLogin(login) {
    const rows = await this._userRows("WHERE LOWER(login) = LOWER($1) LIMIT 1", [String(login || "")]);
    return rows[0] || null;
  }

  async createUser(f) {
    const res = await this.pool.query(
      `INSERT INTO users
        (login, email, pass_hash, role, banned, ban_reason, lifetime, sub_until, reg_at, last_login, last_ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        f.login, f.email, f.passHash, f.role || "default",
        !!f.banned, f.banReason || "", !!f.lifetime,
        f.subUntil == null ? null : f.subUntil,
        f.regAt, f.lastLogin == null ? null : f.lastLogin,
        f.lastIp || ""
      ]
    );
    const rows = await this._userRows("WHERE id = $1", [res.rows[0].id]);
    return rows[0];
  }

  async updateUser(login, patch) {
    const cols = {
      role: "role", banned: "banned", banReason: "ban_reason",
      lifetime: "lifetime", subUntil: "sub_until", lastLogin: "last_login",
      lastIp: "last_ip", email: "email", passHash: "pass_hash",
      avatar: "avatar", totpSecret: "totp_secret", totpEnabled: "totp_enabled"
    };
    const sets = [];
    const params = [];
    for (const key of Object.keys(patch)) {
      if (!(key in cols)) continue;
      params.push(patch[key]);
      sets.push(`${cols[key]} = $${params.length}`);
    }
    if (!sets.length) return this.getUserByLogin(login);
    params.push(String(login));
    const res = await this.pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE LOWER(login) = LOWER($${params.length}) RETURNING *`,
      params
    );
    if (!res.rows[0]) return null;
    const rows = await this._userRows("WHERE id = $1", [res.rows[0].id]);
    return rows[0];
  }

  async addHistory(login, label) {
    await this.pool.query(
      "INSERT INTO history (login, at, label) VALUES ($1,$2,$3)",
      [String(login), Date.now(), String(label)]
    );
  }

  async createSession(token, login) {
    await this.pool.query(
      "INSERT INTO sessions (token, login, created_at) VALUES ($1,$2,$3) ON CONFLICT (token) DO NOTHING",
      [token, login, Date.now()]
    );
  }

  async deleteSession(token) {
    await this.pool.query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  async getUserByToken(token) {
    const res = await this.pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.login = s.login WHERE s.token = $1 LIMIT 1`,
      [String(token)]
    );
    if (!res.rows[0]) return null;
    const rows = await this._userRows("WHERE id = $1", [res.rows[0].id]);
    return rows[0];
  }

  async upsertKeys(keys) {
    for (const k of keys) {
      await this.pool.query(
        `INSERT INTO keys (code, plan, created_at, created_by)
         VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [k.code, k.plan, k.createdAt, k.createdBy]
      );
    }
  }

  mapKey(r) {
    return {
      code: r.code,
      plan: r.plan,
      createdAt: Number(r.created_at),
      createdBy: r.created_by,
      usedBy: r.used_by,
      usedAt: r.used_at == null ? null : Number(r.used_at)
    };
  }

  async getAllKeys() {
    const res = await this.pool.query("SELECT * FROM keys ORDER BY created_at DESC");
    return res.rows.map(r => this.mapKey(r));
  }

  async getKey(code) {
    const res = await this.pool.query("SELECT * FROM keys WHERE UPPER(code) = UPPER($1)", [String(code || "")]);
    return res.rows[0] ? this.mapKey(res.rows[0]) : null;
  }

  async consumeKey(code, login) {
    const res = await this.pool.query(
      "UPDATE keys SET used_by = $2, used_at = $3 WHERE UPPER(code) = UPPER($1) AND used_by IS NULL RETURNING *",
      [String(code), login, Date.now()]
    );
    return res.rows[0] ? this.mapKey(res.rows[0]) : null;
  }

  async deleteKey(code) {
    const res = await this.pool.query("DELETE FROM keys WHERE UPPER(code) = UPPER($1)", [String(code)]);
    return res.rowCount > 0;
  }

  async getAllUsers() {
    return this._userRows("ORDER BY id ASC", []);
  }

  async getChatMessages(after) {
    const a = parseInt(after, 10) || 0;
    const query = a > 0
      ? "SELECT id, login, text, at FROM messages WHERE id > $1 ORDER BY id ASC LIMIT 100"
      : "SELECT * FROM (SELECT id, login, text, at FROM messages ORDER BY id DESC LIMIT 50) t ORDER BY id ASC";
    const res = await this.pool.query(query, a > 0 ? [a] : []);
    return res.rows.map(r => ({ id: r.id, login: r.login, text: r.text, at: Number(r.at) }));
  }

  async addChatMessage(login, text) {
    const res = await this.pool.query(
      "INSERT INTO messages (login, text, at) VALUES ($1,$2,$3) RETURNING id, login, text, at",
      [login, String(text).slice(0, 240), Date.now()]
    );
    const r = res.rows[0];
    return { id: r.id, login: r.login, text: r.text, at: Number(r.at) };
  }

  async upsertPromos(list) {
    for (const p of list) {
      await this.pool.query(
        "INSERT INTO promos (code, percent, active, uses, created_at, created_by) VALUES ($1,$2,TRUE,0,$3,$4) ON CONFLICT (code) DO NOTHING",
        [p.code, p.percent, p.createdAt, p.createdBy]
      );
    }
  }

  async getAllPromos() {
    const res = await this.pool.query("SELECT * FROM promos ORDER BY created_at DESC");
    return res.rows.map(r => ({
      code: r.code,
      percent: r.percent,
      active: r.active,
      uses: r.uses,
      createdAt: Number(r.created_at),
      createdBy: r.created_by
    }));
  }

  async getPromo(code) {
    const res = await this.pool.query(
      "SELECT code, percent FROM promos WHERE UPPER(code) = UPPER($1) AND active = TRUE",
      [String(code || "")]
    );
    return res.rows[0] ? { code: res.rows[0].code, percent: res.rows[0].percent } : null;
  }

  async incrPromoUse(code) {
    const res = await this.pool.query(
      "UPDATE promos SET uses = uses + 1 WHERE UPPER(code) = UPPER($1) RETURNING code",
      [String(code || "")]
    );
    return res.rowCount > 0;
  }

  async deletePromo(code) {
    const res = await this.pool.query("DELETE FROM promos WHERE UPPER(code) = UPPER($1)", [String(code)]);
    return res.rowCount > 0;
  }
}

/* ==========================================================================
   Фабрика: DATABASE_URL → PostgreSQL, иначе → локальный JSON-файл.
   ========================================================================== */
async function createStore() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const file = process.env.DATA_FILE || path.join(__dirname, "data", "aethra.json");
    console.log("[storage] DATABASE_URL не задан — использую локальный файл: " + file);
    return new FileStore(file).init();
  }

  let host = "";
  try { host = new URL(url).hostname; } catch (e) {}
  let ssl = false;
  if (/neon\.tech$/i.test(host) || /\.render\.com$/i.test(host) || /supabase\.(co|com)$/i.test(host)) {
    ssl = { rejectUnauthorized: false };
  }
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, ssl });
  const store = new PgStore(pool);
  await store.init();
  console.log("[storage] Подключён PostgreSQL: " + host);
  return store;
}

module.exports = { createStore };
