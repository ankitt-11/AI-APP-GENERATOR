import { Module } from '@nestjs/common';
import { MetadataController } from './metadata.controller';
import { MetadataService } from './metadata.service';
import { ValidationEngine } from './engines/validation.engine';
import { NormalizationEngine } from './engines/normalization.engine';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [MetadataController],
  providers: [MetadataService, ValidationEngine, NormalizationEngine],
  exports: [MetadataService, ValidationEngine, NormalizationEngine],
})
export class MetadataModule {}
