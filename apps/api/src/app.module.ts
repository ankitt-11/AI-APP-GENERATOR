import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppsModule } from './modules/apps/apps.module';
import { MetadataModule } from './modules/metadata/metadata.module';
import { RuntimeModule } from './modules/runtime/runtime.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { CsvModule } from './modules/csv/csv.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    // Configuration — loads .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting — 100 req/min default, tighter on write routes via decorator
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'write', ttl: 60000, limit: 20 },
    ]),

    // In-memory cache — 60s TTL, used by MetadataModule for active definitions
    CacheModule.register({ isGlobal: true, ttl: 60000 }),

    // Infrastructure
    PrismaModule,

    // Feature Modules
    AuthModule,
    AppsModule,
    MetadataModule,
    RuntimeModule,
    WorkflowModule,
    CsvModule,
    NotificationsModule,
    AuditModule,
    AiModule,
  ],
})
export class AppModule {}
