import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/error.js';
import { appUrl } from './appUrl.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function qstashConfigured(): boolean {
  return Boolean(
    appUrl() &&
      process.env.QSTASH_URL &&
      process.env.QSTASH_TOKEN &&
      process.env.QSTASH_CURRENT_SIGNING_KEY &&
      process.env.QSTASH_NEXT_SIGNING_KEY,
  );
}

// Ask QStash to POST `body` to our `/api/v1<path>` at `at`. QStash stores it, waits, delivers, and
// retries if we answer with an error. Returns QStash's message id.
export async function publishAt(path: string, body: unknown, at: Date): Promise<string> {
  const destination = `${appUrl()}/api/v1${path}`;
  const res = await fetch(`${process.env.QSTASH_URL}/v2/publish/${destination}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      // Unix seconds. A time already in the past is delivered straight away.
      'Upstash-Not-Before': String(Math.floor(at.getTime() / 1000)),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`qstash publish failed: ${res.status} ${await res.text().catch(() => '')}`);
  return ((await res.json()) as { messageId: string }).messageId;
}

function verifyWith(token: string, key: string): jwt.JwtPayload | null {
  try {
    const claims = jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'Upstash', clockTolerance: 60 });
    return typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

// Only QStash may call the reminder endpoints. Its Upstash-Signature header is a JWT signed with our
// signing key that names the URL it was sent to and the SHA-256 of the body, so it can't be forged,
// redirected to another endpoint, or have its body swapped. Two keys exist so Upstash can rotate them.
export const verifyQstash: RequestHandler = (req, _res, next) => {
  const token = req.get('upstash-signature');
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!token || !current || !nextKey) {
    next(new AppError(401, 'unauthorized', 'missing signature'));
    return;
  }
  const claims = verifyWith(token, current) ?? verifyWith(token, nextKey);
  // The hourly sweep has no body, so the JSON parser never captured one: its hash is of zero bytes.
  const bodyHash = createHash('sha256').update(req.rawBody ?? Buffer.alloc(0)).digest('base64url');
  const expectedUrl = `${appUrl()}${req.originalUrl}`;
  if (!claims || claims.sub !== expectedUrl || String(claims.body).replace(/=+$/, '') !== bodyHash) {
    next(new AppError(401, 'unauthorized', 'invalid signature'));
    return;
  }
  next();
};
