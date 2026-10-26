import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { importForDriver, selectedDriver } from './import-for-driver.js';

const GREETING = Symbol('GREETING');

@Global()
@Module({
  providers: [{ provide: GREETING, useValue: 'mongo' }],
  exports: [GREETING],
})
class FakeMongoModule {}

@Global()
@Module({
  providers: [{ provide: GREETING, useValue: 'dynamo' }],
  exports: [GREETING],
})
class FakeDynamoModule {}

async function greetingFor(driver: string | undefined): Promise<string> {
  if (driver) {
    vi.stubEnv('DATABASE_DRIVER', driver);
  }
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true }),
      ...importForDriver('DATABASE_DRIVER', {
        mongodb: FakeMongoModule,
        dynamodb: FakeDynamoModule,
      }),
    ],
  }).compile();
  return moduleRef.get<string>(GREETING);
}

describe('importForDriver', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('loads only the module of the selected driver', async () => {
    await expect(greetingFor('dynamodb')).resolves.toBe('dynamo');
  });

  it('uses the local driver when the variable is not set', async () => {
    vi.stubEnv('DATABASE_DRIVER', undefined);

    await expect(greetingFor(undefined)).resolves.toBe('mongo');
  });
});

describe('selectedDriver', () => {
  it('reads the driver from the environment', () => {
    expect(selectedDriver({ QUEUE_DRIVER: 'sqs' }, 'QUEUE_DRIVER')).toBe('sqs');
  });

  it('falls back to the local default', () => {
    expect(selectedDriver({}, 'EVENTS_DRIVER')).toBe('redis');
  });
});
