import type { NextApiRequest, NextApiResponse } from 'next';
import app from '@dossier/api';

export const config = {
  api: { bodyParser: false },
  maxDuration: 300,
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return app(req, res);
}
