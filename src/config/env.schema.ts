import { z } from 'zod';
import { LOG_FORMATS } from '../common/logging/create-app-logger.js';

export const DATABASE_DRIVERS = ['mongodb', 'dynamodb'] as const;
export const STORAGE_DRIVERS = ['local', 's3'] as const;
export const QUEUE_DRIVERS = ['bullmq', 'sqs'] as const;
export const LLM_DRIVERS = ['openai'] as const;
export const EVENTS_DRIVERS = ['redis', 'none'] as const;

/** Drivers del entorno local; también los usa la selección de módulos (`importForDriver`). */
export const DEFAULT_DRIVERS = {
  DATABASE_DRIVER: 'mongodb',
  STORAGE_DRIVER: 'local',
  QUEUE_DRIVER: 'bullmq',
  EVENTS_DRIVER: 'redis',
} as const;

const optionalText = z.string().min(1).optional();

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.url().default('http://localhost:4200'),
  LOG_FORMAT: z.enum(LOG_FORMATS).default('pretty'),
  DATABASE_DRIVER: z
    .enum(DATABASE_DRIVERS)
    .default(DEFAULT_DRIVERS.DATABASE_DRIVER),
  MONGODB_URI: optionalText,
  AWS_REGION: z.string().min(1).default('us-east-1'),
  DYNAMODB_DOCUMENTS_TABLE: optionalText,
  DYNAMODB_CONVERSATIONS_TABLE: optionalText,
  DYNAMODB_MESSAGES_TABLE: optionalText,
  STORAGE_DRIVER: z
    .enum(STORAGE_DRIVERS)
    .default(DEFAULT_DRIVERS.STORAGE_DRIVER),
  LOCAL_STORAGE_DIR: z.string().min(1).default('./uploads'),
  S3_BUCKET: optionalText,
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(50).default(10),
  QUEUE_DRIVER: z.enum(QUEUE_DRIVERS).default(DEFAULT_DRIVERS.QUEUE_DRIVER),
  SQS_QUEUE_URL: z.url().optional(),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  PROCESSING_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  PROCESSING_BACKOFF_MS: z.coerce.number().int().min(100).default(5000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  EVENTS_DRIVER: z.enum(EVENTS_DRIVERS).default(DEFAULT_DRIVERS.EVENTS_DRIVER),
  EVENTS_HEARTBEAT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(25000),
  LLM_DRIVER: z.enum(LLM_DRIVERS).default('openai'),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default('gpt-6-luna'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  LLM_MAX_INPUT_CHARS: z.coerce.number().int().min(1000).default(50000),
  AGENT_MAX_ITERATIONS: z.coerce.number().int().min(2).max(10).default(5),
});

type BaseEnv = z.infer<typeof baseEnvSchema>;

/** Variables que solo son obligatorias cuando se elige cierto driver. */
interface DriverRequirement {
  driverKey: keyof BaseEnv;
  driver: string;
  required: (keyof BaseEnv)[];
}

const DRIVER_REQUIREMENTS: DriverRequirement[] = [
  {
    driverKey: 'DATABASE_DRIVER',
    driver: 'mongodb',
    required: ['MONGODB_URI'],
  },
  {
    driverKey: 'DATABASE_DRIVER',
    driver: 'dynamodb',
    required: [
      'DYNAMODB_DOCUMENTS_TABLE',
      'DYNAMODB_CONVERSATIONS_TABLE',
      'DYNAMODB_MESSAGES_TABLE',
    ],
  },
  { driverKey: 'STORAGE_DRIVER', driver: 's3', required: ['S3_BUCKET'] },
  { driverKey: 'QUEUE_DRIVER', driver: 'sqs', required: ['SQS_QUEUE_URL'] },
];

export const envSchema = baseEnvSchema.superRefine((env, context) => {
  for (const { driverKey, driver, required } of DRIVER_REQUIREMENTS) {
    if (env[driverKey] !== driver) {
      continue;
    }
    for (const key of required.filter((name) => env[name] === undefined)) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: `Required when ${driverKey}=${driver}`,
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;
export type DatabaseDriver = Env['DATABASE_DRIVER'];
export type StorageDriver = Env['STORAGE_DRIVER'];
export type QueueDriver = Env['QUEUE_DRIVER'];
export type LlmDriver = Env['LLM_DRIVER'];
