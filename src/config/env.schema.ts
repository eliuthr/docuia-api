import { z } from 'zod';

export const STORAGE_DRIVERS = ['local'] as const;

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.url().default('http://localhost:4200'),
  MONGODB_URI: z.string().min(1),
  STORAGE_DRIVER: z.enum(STORAGE_DRIVERS).default('local'),
  LOCAL_STORAGE_DIR: z.string().min(1).default('./uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(50).default(10),
});

export type Env = z.infer<typeof envSchema>;
export type StorageDriver = Env['STORAGE_DRIVER'];
