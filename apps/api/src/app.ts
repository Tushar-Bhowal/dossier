import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { runsRouter } from './routes/runs.js';
import { kitsRouter } from './routes/kits.js';
import { regenerateRouter } from './routes/regenerate.js';
import { practiceRouter } from './routes/practice.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

const app = express();
const v1 = express.Router();

v1.use(express.json());
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
