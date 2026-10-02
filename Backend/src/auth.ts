import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';

export type User = { id: string; name: string; email: string };
const cookieName = 'qlean_session';
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.secureCookies, path: '/' };
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const password = z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must not exceed 72 UTF-8 bytes.');
const registerSchema = z.object({ name: z.string().trim().min(1).max(80), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72) });

function setSession(res: express.Response, user: User) {
  const token = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: '7d', algorithm: 'HS256' });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function currentUser(res: express.Response): User | null { return res.locals.user ?? null; }

export const authenticate: express.RequestHandler = async (req, res, next) => {
  res.locals.user = null;
  const token = req.cookies?.[cookieName];
  if (typeof token !== 'string') { next(); return; }
  let userId: string;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || !z.string().uuid().safeParse(payload.sub).success) throw new Error('Invalid session');
    userId = payload.sub;
  } catch {
    res.clearCookie(cookieName, cookieOptions);
    next();
    return;
  }
  try {
    const result = await pool.query<User>('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    res.locals.user = result.rows[0] ?? null;
    next();
  } catch (error) { next(error); }
};

export const authRouter = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Try again in 15 minutes.' } });

authRouter.get('/me', (_req, res) => res.json({ data: currentUser(res) }));
authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const result = await pool.query<User>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [input.name, input.email, hash],
    );
    const user = result.rows[0];
    setSession(res, user);
    res.status(201).json({ data: user });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      res.status(409).json({ message: 'An account with this email already exists.' });
      return;
    }
    next(error);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await pool.query<User & { password_hash: string }>(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1', [input.email],
    );
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(input.password, row.password_hash))) {
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }
    const user: User = { id: row.id, name: row.name, email: row.email };
    setSession(res, user);
    res.json({ data: user });
  } catch (error) { next(error); }
});

authRouter.post('/logout', (_req, res) => { res.clearCookie(cookieName, cookieOptions); res.status(204).end(); });
