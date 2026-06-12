import { Module } from '@nestjs/common';
import { CsvController } from './csv.controller';
import { CsvService } from './csv.service';
import { CsvParser, ImportProcessor } from './csv.parser';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [CsvController],
  providers: [CsvService, CsvParser, ImportProcessor],
})
export class CsvModule {}
