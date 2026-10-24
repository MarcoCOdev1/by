import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import { config } from '../config.js';

const SQLiteStore = connectSqlite3(session);
export const sessionStore = new SQLiteStore({ db: 'sessions.sqlite', dir: config.dataDir, concurrentDb: true });
export const sessionMiddleware = session({
  name: 'bypasser.sid', secret: config.sessionSecret, store: sessionStore,
  resave: false, saveUninitialized: false, rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 7 * 24 * 3600 * 1000 }
});
