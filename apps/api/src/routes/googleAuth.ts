import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { users, type UserDoc } from '../db/users.js';
import { setSessionCookie, signSession } from '../middleware/auth.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const STATE_COOKIE = 'dossier_google_oauth';
const STATE_COOKIE_PATH = '/api/v1/auth/google';
const STATE_TTL_MS = 10 * 60 * 1000;

const IdTokenClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean(),
  exp: z.number(),
});

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// Google only redirects to URIs registered on the OAuth client, so a forged Host header just makes
// the sign-in fail at Google rather than sending the code anywhere else.
function callbackUrl(req: Request): string {
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('host')}${STATE_COOKIE_PATH}/callback`;
}

function backToLogin(res: Response, reason: 'google_unavailable' | 'google_cancelled' | 'google_failed'): void {
  res.redirect(303, `/login?error=${reason}`);
}

async function exchangeCode(google: GoogleConfig, code: string, verifier: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { id_token?: unknown };
  if (typeof body.id_token !== 'string') return null;

  // Received straight from Google's token endpoint over TLS, so OpenID Connect (Core §3.1.3.7)
  // lets the signature check be skipped; the claims themselves are still checked.
  const payload = body.id_token.split('.')[1] ?? '';
  const claims = IdTokenClaims.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  if (!claims.success) return null;
  const { iss, aud, sub, email, email_verified, exp } = claims.data;
  if (!ISSUERS.has(iss) || aud !== google.clientId || exp * 1000 <= Date.now() || !email_verified) return null;
  return { sub, email };
}

async function signInGoogleUser(identity: { sub: string; email: string }): Promise<string> {
  const col = await users();
  const known = await col.findOne({ googleSub: identity.sub });
  if (known) return known._id;

  // Password sign-up never verified the email, so anyone could have registered this address first.
  // Google has now proven who owns it: link the account and drop that unverified password, so
  // whoever chose it loses the way in.
  const linked = await col.findOneAndUpdate(
    { email: identity.email },
    { $set: { googleSub: identity.sub }, $unset: { passwordHash: '' } },
    { returnDocument: 'after' },
  );
  if (linked) return linked._id;

  const user: UserDoc = {
    _id: randomUUID(),
    email: identity.email,
    googleSub: identity.sub,
    createdAt: new Date().toISOString(),
  };
  await col.insertOne(user);
  return user._id;
}

export const googleAuthRouter = Router();

googleAuthRouter.get('/', (req, res) => {
  const google = googleConfig();
  if (!google) {
    backToLogin(res, 'google_unavailable');
    return;
  }
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  res.cookie(STATE_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
    path: STATE_COOKIE_PATH,
  });
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  res.redirect(303, `${AUTH_URL}?${params}`);
});

googleAuthRouter.get('/callback', async (req, res) => {
  const stored: unknown = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });

  const google = googleConfig();
  if (!google) {
    backToLogin(res, 'google_unavailable');
    return;
  }
  if (req.query.error !== undefined) {
    backToLogin(res, 'google_cancelled');
    return;
  }

  const { code, state } = req.query;
  const [expectedState, verifier] = typeof stored === 'string' ? stored.split('.') : [];
  if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || !verifier || state !== expectedState) {
    backToLogin(res, 'google_failed');
    return;
  }

  try {
    const identity = await exchangeCode(google, code, verifier, callbackUrl(req));
    if (!identity) {
      backToLogin(res, 'google_failed');
      return;
    }
    setSessionCookie(res, signSession(await signInGoogleUser(identity)));
    res.redirect(303, '/home');
  } catch (err) {
    console.error('Google sign-in failed:', err);
    backToLogin(res, 'google_failed');
  }
});
