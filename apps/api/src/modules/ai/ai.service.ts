import { Injectable } from '@nestjs/common';
import { SchemaAnalyzer } from './schema-analyzer';
import { ValidationEngine } from '../metadata/engines/validation.engine';

@Injectable()
export class AiService {
  constructor(
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly validationEngine: ValidationEngine,
  ) {}

  analyze(rawMetadata: unknown) {
    // First validate/repair the input
    const validationResult = this.validationEngine.validate(rawMetadata);
    // Then analyze the repaired metadata for AI suggestions
    const analysisResult = this.schemaAnalyzer.analyze(validationResult.repaired);

    return {
      ...analysisResult,
      validationWarnings: validationResult.warnings,
      validationRepairs: validationResult.repairs,
    };
  }
}
