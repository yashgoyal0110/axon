import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import type { AuthedRequest } from './common/types';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 6002;
  const env = config.get<string>('app.env');

  app.setGlobalPrefix('api', { exclude: ['/'] });

  // Keep the raw body around for provider webhook signature checks - the
  // parsed object cannot be re-serialised byte-for-byte.
  const rawBodySaver = (req: AuthedRequest, _res: Response, buf: Buffer) => {
    if (buf?.length) req.rawBody = buf;
  };
  app.use(express.json({ limit: '2mb', verify: rawBodySaver as never }));
  app.use(express.urlencoded({ extended: true, limit: '2mb', verify: rawBodySaver as never }));

  app.use(
    helmet({
      // The SPA is served from this origin; CSP is handled by the reverse proxy
      // in front of the container so local dev tooling keeps working.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: env === 'production' ? [config.get<string>('app.publicUrl') as string] : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Axon API')
    .setDescription('Multi-tenant WhatsApp AI chatbot platform')
    .setVersion('2.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    customSiteTitle: 'Axon API',
    swaggerOptions: { persistAuthorization: true },
  });

  // SPA history fallback: anything that is not an API route resolves to
  // index.html so client-side routes survive a hard refresh.
  const webDist = join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(join(webDist, 'index.html'))) {
    app.use((req: Request, res: Response, next: () => void) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      if (req.path.includes('.')) return next();
      res.sendFile(join(webDist, 'index.html'));
    });
  } else {
    logger.warn('No SPA build found at web/dist - serving the API only.');
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Axon listening on http://0.0.0.0:${port} (${env})`);
  logger.log(`API docs at http://0.0.0.0:${port}/api/docs`);
}

void bootstrap();
