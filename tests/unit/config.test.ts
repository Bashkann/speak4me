import { loadConfig } from '../../src/config';

const productionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@database.internal:5432/speaking',
  CORS_ORIGIN: 'https://speak.example.com, https://www.speak.example.com',
  JWT_ACCESS_SECRET: 'production-access-secret-with-32-characters',
  JWT_REFRESH_SECRET: 'production-refresh-secret-with-32-characters',
  LIVEKIT_URL: 'wss://speaking.livekit.cloud',
  LIVEKIT_API_KEY: 'production-key',
  LIVEKIT_API_SECRET: 'production-secret',
};

describe('production configuration', () => {
  it('normalizes the configured CORS allowlist', () => {
    const config = loadConfig(productionEnv);
    expect(config.CORS_ORIGIN).toEqual([
      'https://speak.example.com',
      'https://www.speak.example.com',
    ]);
    expect(config.TOPIC_OFFER_CAP).toBe(3);
    expect(config.IMAGE_UPLOADS_ENABLED).toBe(false);
  });

  it('requires every private storage setting when image uploads are enabled', () => {
    expect(() => loadConfig({ ...productionEnv, IMAGE_UPLOADS_ENABLED: 'true' })).toThrow(/S3_REGION/);
  });

  it('rejects insecure production browser and media URLs', () => {
    expect(() => loadConfig({
      ...productionEnv,
      CORS_ORIGIN: 'http://speak.example.com',
      LIVEKIT_URL: 'ws://speaking.livekit.cloud',
    })).toThrow(/must use (https|wss):\/\//);
  });

  it('fails fast when a required production secret is missing', () => {
    const env = { ...productionEnv };
    delete env.JWT_ACCESS_SECRET;
    expect(() => loadConfig(env)).toThrow(/JWT_ACCESS_SECRET/);
  });
});
