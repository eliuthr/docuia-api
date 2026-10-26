import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema.js';
import { requireConfig } from './require-config.js';

function configWith(values: Partial<Env>): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

describe('requireConfig', () => {
  it('returns the value when it is set', () => {
    expect(
      requireConfig(configWith({ S3_BUCKET: 'docuia-files' }), 'S3_BUCKET'),
    ).toBe('docuia-files');
  });

  it('names the variable when it is missing', () => {
    expect(() => requireConfig(configWith({}), 'S3_BUCKET')).toThrow(
      'Missing configuration: S3_BUCKET',
    );
  });
});
