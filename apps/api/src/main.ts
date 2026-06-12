import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // ─── Health check endpoint (used by Railway) ─────────────────────────────────
  // Accessible at GET /api/health — before global prefix kicks in via express
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────────
  // Allow requests from local dev and any Vercel deployment (preview + prod)
  const allowedOrigins = [
    'http://localhost:3000',
    // Production Vercel URL (set FRONTEND_URL env var on Railway)
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow any vercel.app subdomain (preview deployments)
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      // Allow explicitly allowed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe — uses class-validator decorators on DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: false, // Don't throw on extra props (we strip them)
      transform: true,           // Auto-transform payloads to DTO classes
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — RFC 7807 Problem JSON responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global response transform interceptor — wraps in { success, data }
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API running on http://0.0.0.0:${port}/api`);
}

bootstrap();
