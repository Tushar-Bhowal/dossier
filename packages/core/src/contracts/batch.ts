import { z } from 'zod';
import { Kit } from './kit.js';

export const BatchCase = z.object({
  id: z.string().min(1),
  jd: z.string().min(1),
  company_url: z.url(),
  days: z.int().positive(),
});
export type BatchCase = z.infer<typeof BatchCase>;

export const BatchInput = z.array(BatchCase);
export type BatchInput = z.infer<typeof BatchInput>;

export const BatchError = z.object({
  code: z.string(),
  message: z.string(),
});
export type BatchError = z.infer<typeof BatchError>;

export const BatchKitResult = z
  .object({
    id: z.string(),
    status: z.enum(['ok', 'failed']),
    kit: Kit.nullable(),
    error: BatchError.nullable(),
  })
  .check((ctx) => {
    const r = ctx.value;
    if (r.status === 'ok' && (r.kit === null || r.error !== null)) {
      ctx.issues.push({
        code: 'custom',
        input: r,
        message: 'status "ok" requires a non-null kit and a null error',
        path: [],
      });
    }
    if (r.status === 'failed' && (r.kit !== null || r.error === null)) {
      ctx.issues.push({
        code: 'custom',
        input: r,
        message: 'status "failed" requires a null kit and a non-null error',
        path: [],
      });
    }
  });
export type BatchKitResult = z.infer<typeof BatchKitResult>;

export const BatchOutput = z.object({
  version: z.literal('1.0'),
  generated_at: z.iso.datetime(),
  kits: z.array(BatchKitResult),
});
export type BatchOutput = z.infer<typeof BatchOutput>;
