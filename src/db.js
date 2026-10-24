import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

mkdirSync(path.join(config.dataDir, 'downloads'), { recursive: true });
export const db = new Database(path.join(config.dataDir, 'bypasser.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL, global_name TEXT,
  avatar TEXT, email TEXT, locale TEXT,
  joined_guild INTEGER DEFAULT 0, joined_at TEXT, last_login TEXT,
  login_count INTEGER DEFAULT 1, banned INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, file TEXT NOT NULL, user_id TEXT,
  ip TEXT, ua TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, title TEXT NOT NULL,
  body TEXT NOT NULL, os TEXT, appver TEXT,
  status TEXT DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, detail TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_downloads_file ON downloads(file);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
`);
export const statements = {
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  upsert: db.prepare(`INSERT INTO users (id, username, global_name, avatar, email, locale, last_login)
    VALUES (@id, @username, @global_name, @avatar, @email, @locale, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET username=excluded.username, global_name=excluded.global_name,
    avatar=excluded.avatar, email=excluded.email, locale=excluded.locale,
    last_login=CURRENT_TIMESTAMP, login_count=users.login_count+1`),
  join: db.prepare('UPDATE users SET joined_guild=1, joined_at=COALESCE(joined_at,CURRENT_TIMESTAMP) WHERE id=?'),
  event: db.prepare('INSERT INTO events (kind,detail) VALUES (?,?)'),
  download: db.prepare('INSERT INTO downloads (file,user_id,ip,ua) VALUES (?,?,?,?)'),
  hits: db.prepare('SELECT COUNT(*) AS hits FROM downloads WHERE file=?'),
  report: db.prepare('INSERT INTO reports (user_id,title,body,os,appver) VALUES (?,?,?,?,?)'),
  reports: db.prepare('SELECT * FROM reports WHERE user_id=? ORDER BY id DESC LIMIT 100'),
  stats: db.prepare(`SELECT (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM downloads) AS downloads,
    (SELECT COUNT(*) FROM users WHERE joined_guild=1) AS joins`),
  search: db.prepare(`SELECT id,username,global_name,joined_guild,banned,is_admin,login_count,created_at
    FROM users WHERE id LIKE @query ESCAPE '\\' OR username LIKE @query ESCAPE '\\'
    ORDER BY created_at DESC LIMIT 100 OFFSET @offset`),
  ban: db.prepare('UPDATE users SET banned=? WHERE id=?'),
  promote: db.prepare('UPDATE users SET is_admin=? WHERE id=?'),
  triage: db.prepare('UPDATE reports SET status=? WHERE id=?')
};
export function publicUser(user) {
  if (!user) return null;
  const { id, username, global_name, avatar, joined_guild, joined_at } = user;
  return { id, username, global_name, avatar, joined_guild, joined_at,
    is_admin: config.adminIds.includes(id) || Boolean(user.is_admin) };
}
