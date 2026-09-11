import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './error.js';

// Parses+replaces req.body with the schema's output (so downstream handlers get typed, coerced
// data) or forwards a structured 400 — every route that touches user input runs its schema
// through this, never a hand-rolled check.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'validation_error', result.error.message));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new AppError(400, 'validation_error', result.error.message));
      return;
    }
    (req as unknown as { validatedQuery: unknown }).validatedQuery = result.data;
    next();
  };
}
