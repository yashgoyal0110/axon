import { Logger } from '@nestjs/common';

const logger = new Logger('Config');

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface AppConfig {
  env: string;
  port: number;
  publicUrl: string;
  appName: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  encryptionKey: string;
  redis: {
    enabled: boolean;
    url?: string;
  };
  ai: {
    apiKey?: string;
    model: string;
    enabled: boolean;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  signupsEnabled: boolean;
  demo: {
    email: string;
    password: string;
  };
  billing: {
    /**
     * Stopgap paywall. Until a real payment provider is wired up, every
     * authenticated owner could switch their workspace onto any plan for free,
     * so an upgrade has to carry this code. Swap the whole check for a Stripe
     * subscription webhook when billing goes live.
     */
    upgradeCoupon: string;
  };
}

export default (): { app: AppConfig } => {
  const env = process.env.NODE_ENV ?? 'development';
  const port = int(process.env.PORT, 6002);

  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (!jwtSecret && env === 'production') {
    // The entrypoint generates one when absent; this only fires on a raw start.
    logger.warn('JWT_SECRET is not set - falling back to an ephemeral secret. Sessions will not survive a restart.');
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    logger.warn(
      'GEMINI_API_KEY is not set - AI replies fall back to the flow\'s configured fallback message. Set it to enable AI.',
    );
  }

  return {
    app: {
      env,
      port,
      publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
      appName: process.env.APP_NAME ?? 'Axon',
      databaseUrl: process.env.DATABASE_URL ?? '',
      jwt: {
        secret: jwtSecret || 'dev-only-insecure-secret-change-me',
        accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
        refreshTtlDays: int(process.env.JWT_REFRESH_TTL_DAYS, 30),
      },
      // 32-byte hex key for AES-256-GCM channel credential encryption.
      encryptionKey:
        process.env.APP_ENCRYPTION_KEY ??
        '0000000000000000000000000000000000000000000000000000000000000000',
      redis: {
        enabled: bool(process.env.ENABLE_REDIS, false) && !!process.env.REDIS_URL,
        url: process.env.REDIS_URL,
      },
      ai: {
        apiKey: geminiKey,
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
        enabled: !!geminiKey,
      },
      throttle: {
        ttl: int(process.env.THROTTLE_TTL, 60),
        limit: int(process.env.THROTTLE_LIMIT, 240),
      },
      signupsEnabled: bool(process.env.SIGNUPS_ENABLED, true),
      demo: {
        email: process.env.DEMO_EMAIL ?? 'demo@axon.app',
        password: process.env.DEMO_PASSWORD ?? 'demo1234',
      },
      billing: {
        upgradeCoupon: process.env.UPGRADE_COUPON ?? 'Yash@0110',
      },
    },
  };
};
