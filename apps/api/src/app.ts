import express from 'express';

const app = express();
const v1 = express.Router();

v1.use(express.json());

v1.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/v1', v1);

export default app;
