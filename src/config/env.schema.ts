import { z } from 'zod';

export const STORAGE_DRIVERS = ['local'] as const;
export const QUEUE_DRIVERS = ['bullmq'] as const;
export const LLM_DRIVERS = ['openai'] as const;

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
  QUEUE_DRIVER: z.enum(QUEUE_DRIVERS).default('bullmq'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  PROCESSING_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  PROCESSING_BACKOFF_MS: z.coerce.number().int().min(100).default(5000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  LLM_DRIVER: z.enum(LLM_DRIVERS).default('openai'),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default('gpt-6-luna'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  LLM_MAX_INPUT_CHARS: z.coerce.number().int().min(1000).default(50000),
  AGENT_MAX_ITERATIONS: z.coerce.number().int().min(2).max(10).default(5),
});

export type Env = z.infer<typeof envSchema>;
export type StorageDriver = Env['STORAGE_DRIVER'];
export type QueueDriver = Env['QUEUE_DRIVER'];
export type LlmDriver = Env['LLM_DRIVER'];
