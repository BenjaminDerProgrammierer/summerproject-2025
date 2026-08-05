import type { Response } from 'express';
import type { z } from 'zod';

export function parseInput<T>(schema: z.ZodType<T>, input: unknown, res: Response): T | undefined {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  res.status(400).json({ message: result.error.issues[0]?.message ?? 'Invalid request' });
  return undefined;
}
