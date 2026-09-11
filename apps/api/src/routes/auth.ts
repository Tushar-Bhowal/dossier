import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { getDb } from '../db/mongo.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth, setSessionCookie, clearSessionCookie, signSession } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const Credentials = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

async function users() {
  const db = await getDb();
  return db.collection<UserDoc>('users');
}

export const authRouter = Router();

authRouter.post('/register', validateBody(Credentials), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof Credentials>;
    const col = await users();
    if (await col.findOne({ email })) {
      next(new AppError(409, 'email_taken', 'an account with this email already exists'));
      return;
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user: UserDoc = { _id: randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };
    await col.insertOne(user);

    setSessionCookie(res, signSession(user._id));
    res.status(201).json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(Credentials), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof Credentials>;
    const col = await users();
    const user = await col.findOne({ email });
    // Same message whether the email doesn't exist or the password is wrong — don't let a login
    // failure confirm which accounts exist.
    const invalid = () => next(new AppError(401, 'invalid_credentials', 'invalid email or password'));
    if (!user) {
      invalid();
      return;
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      invalid();
      return;
    }
    setSessionCookie(res, signSession(user._id));
    res.json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const col = await users();
    const user = await col.findOne({ _id: req.userId });
    if (!user) {
      next(new AppError(401, 'unauthorized', 'sign in required'));
      return;
    }
    res.json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
});
