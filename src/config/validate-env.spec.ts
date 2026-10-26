import { validateEnv } from './validate-env.js';

const MONGODB_URI = 'mongodb://localhost:27017/docuia';
const OPENAI_API_KEY = 'sk-test';
const REQUIRED = { MONGODB_URI, OPENAI_API_KEY };

describe('validateEnv', () => {
  it('applies defaults when only required variables are set', () => {
    const env = validateEnv(REQUIRED);

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: 'http://localhost:4200',
      LOG_FORMAT: 'pretty',
      DATABASE_DRIVER: 'mongodb',
      MONGODB_URI,
      AWS_REGION: 'us-east-1',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: './uploads',
      MAX_UPLOAD_SIZE_MB: 10,
      QUEUE_DRIVER: 'bullmq',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      PROCESSING_MAX_ATTEMPTS: 3,
      PROCESSING_BACKOFF_MS: 5000,
      WORKER_CONCURRENCY: 2,
      EVENTS_DRIVER: 'redis',
      EVENTS_HEARTBEAT_MS: 25000,
      LLM_DRIVER: 'openai',
      OPENAI_API_KEY,
      OPENAI_MODEL: 'gpt-6-luna',
      LLM_TIMEOUT_MS: 60000,
      LLM_MAX_INPUT_CHARS: 50000,
      AGENT_MAX_ITERATIONS: 5,
    });
  });

  it('rejects zero processing attempts', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, PROCESSING_MAX_ATTEMPTS: '0' }),
    ).toThrow(/PROCESSING_MAX_ATTEMPTS/);
  });

  it('coerces numeric variables from strings', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      MAX_UPLOAD_SIZE_MB: '5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.MAX_UPLOAD_SIZE_MB).toBe(5);
  });

  it('names the missing variable when a required one is absent', () => {
    expect(() => validateEnv({ OPENAI_API_KEY })).toThrow(/MONGODB_URI/);
  });

  it('requires the OpenAI API key', () => {
    expect(() => validateEnv({ MONGODB_URI })).toThrow(/OPENAI_API_KEY/);
  });

  it('rejects an unsupported LLM driver', () => {
    expect(() => validateEnv({ ...REQUIRED, LLM_DRIVER: 'gemini' })).toThrow(
      /LLM_DRIVER/,
    );
  });

  it('rejects an LLM input limit below the minimum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, LLM_MAX_INPUT_CHARS: '10' }),
    ).toThrow(/LLM_MAX_INPUT_CHARS/);
  });

  it('rejects an agent iteration limit above the maximum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, AGENT_MAX_ITERATIONS: '50' }),
    ).toThrow(/AGENT_MAX_ITERATIONS/);
  });

  it('rejects a heartbeat interval above the maximum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, EVENTS_HEARTBEAT_MS: '120000' }),
    ).toThrow(/EVENTS_HEARTBEAT_MS/);
  });

  it('rejects an unsupported storage driver', () => {
    expect(() => validateEnv({ ...REQUIRED, STORAGE_DRIVER: 'ftp' })).toThrow(
      /STORAGE_DRIVER/,
    );
  });

  describe('driver requirements', () => {
    const AWS_ENV = {
      OPENAI_API_KEY,
      DATABASE_DRIVER: 'dynamodb',
      DYNAMODB_DOCUMENTS_TABLE: 'docuia-documents',
      DYNAMODB_CONVERSATIONS_TABLE: 'docuia-conversations',
      DYNAMODB_MESSAGES_TABLE: 'docuia-messages',
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'docuia-files',
      QUEUE_DRIVER: 'sqs',
      SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123456789012/docuia',
      EVENTS_DRIVER: 'none',
    };

    it('accepts the AWS drivers without MongoDB', () => {
      const env = validateEnv(AWS_ENV);

      expect(env.MONGODB_URI).toBeUndefined();
      expect(env.DATABASE_DRIVER).toBe('dynamodb');
    });

    it.each([
      'DYNAMODB_DOCUMENTS_TABLE',
      'DYNAMODB_CONVERSATIONS_TABLE',
      'DYNAMODB_MESSAGES_TABLE',
      'S3_BUCKET',
      'SQS_QUEUE_URL',
    ])('requires %s for its driver', (key) => {
      const env: Record<string, string> = { ...AWS_ENV };
      delete env[key];

      expect(() => validateEnv(env)).toThrow(key);
      expect(() => validateEnv(env)).toThrow(/Required when/);
    });

    it('rejects a queue URL that is not a URL', () => {
      expect(() =>
        validateEnv({ ...AWS_ENV, SQS_QUEUE_URL: 'docuia-queue' }),
      ).toThrow(/SQS_QUEUE_URL/);
    });
  });

  it('rejects an upload limit above the maximum', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, MAX_UPLOAD_SIZE_MB: '500' }),
    ).toThrow(/MAX_UPLOAD_SIZE_MB/);
  });
});
