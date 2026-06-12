import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SchemaAnalyzer } from './schema-analyzer';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [MetadataModule],
  controllers: [AiController],
  providers: [AiService, SchemaAnalyzer],
})
export class AiModule {}
