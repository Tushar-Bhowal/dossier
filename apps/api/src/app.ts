import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { runsRouter } from './routes/runs.js';
import { kitsRouter } from './routes/kits.js';
import { regenerateRouter } from './routes/regenerate.js';
import { practiceRouter } from './routes/practice.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

const app = express();

// Nothing here does ETag-based concurrency — the kit version travels in the request body — so an
// ETag on a per-user, never-cached response serves no purpose. Note this only removes Express's
// own: Vercel's edge adds one of its own regardless, which is why the client must not send
// `If-Match` (see apps/web/src/lib/api.ts).
app.set('etag', false);

const v1 = express.Router();

// Every response here is per-user and dynamic, but these were going out as
// `Cache-Control: public, max-age=0, must-revalidate` — `public` is wrong for a response carrying
// one user's identity or their kits, however short-lived the permission to store it is.
v1.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// A PATCH sends the whole kit back on every edit (Task 27), and a well-populated kit — many
// questions/flashcards with full answer guides, a long schedule — can run well past Express's
// default 100kb body limit, failing every save for that kit with no clear signal why.
v1.use(express.json({ limit: '5mb' }));
v1.use(cookieParser());

v1.get('/health', (_req, res) => {
  res.json({ ok: true });
});

v1.use('/auth', authRouter);
v1.use('/runs', runsRouter);
v1.use('/kits', kitsRouter);
v1.use('/kits', regenerateRouter);
v1.use('/kits', practiceRouter);

app.use('/api/v1', v1);

app.use('/api/v1', notFoundHandler);
app.use(errorHandler);

export default app;
