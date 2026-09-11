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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  res.status(500).json({ code: 'internal_error', message });
};
