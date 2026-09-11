import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.js';

export const SESSION_COOKIE = 'dossier_session';
const SESSION_TTL = '7d';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required (see .env.example)');
  }
  return secret;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, jwtSecret());
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: import('express').Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: import('express').Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Every kit/run route sits behind this. A missing or invalid cookie is a structured 401 — the
// client turns that into a "your session expired" redirect rather than a raw fetch failure.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = typeof token === 'string' ? verifySession(token) : null;
  if (!userId) {
    next(new AppError(401, 'unauthorized', 'sign in required'));
    return;
  }
  req.userId = userId;
  next();
};
