import type { ErrorRequestHandler, RequestHandler } from 'express';

// Every error response carries this exact shape (Task 22's done-when) so the client never has to
// branch on which route produced it.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ code: 'not_found', message: `no route for ${req.method} ${req.path}` });
};

// A non-AppError thrown from third-party middleware (body-parser's PayloadTooLargeError, for one)
// still carries a real HTTP status on `.status`/`.statusCode` — reporting 500 for all of these
// discards that and misrepresents e.g. a 413 as an opaque server crash to the client.
function statusOf(err: unknown): number {
  if (typeof err !== 'object' || err === null) return 500;
  const status = (err as { status?: unknown; statusCode?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 600 ? status : 500;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }
  const status = statusOf(err);
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  res.status(status).json({ code: status === 413 ? 'payload_too_large' : 'internal_error', message });
};
