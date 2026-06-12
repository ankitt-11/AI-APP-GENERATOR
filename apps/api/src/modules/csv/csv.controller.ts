import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CsvService } from './csv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Controller('apps/:appId/imports')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  @Get()
  listImports(
    @Param('appId') appId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.csvService.listImports(appId, user.sub, page, limit);
  }

  @Get(':importId')
  getImport(
    @Param('appId') appId: string,
    @Param('importId') importId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.csvService.getImport(importId, appId, user.sub);
  }

  /**
   * Stage 1: Upload CSV file + detect columns + infer types.
   * Never writes to disk — buffer stored in memory.
   * Max 10MB enforced by multer limits.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
          return cb(new Error('Only CSV files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAndAnalyze(
    @Param('appId') appId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('entityId') entityId: string,
  ) {
    return this.csvService.uploadAndAnalyze(appId, user.sub, entityId, file);
  }

  /**
   * Stage 2: Confirm field mappings and execute import.
   */
  @Post(':importId/process')
  @HttpCode(HttpStatus.OK)
  processImport(
    @Param('appId') appId: string,
    @Param('importId') importId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { mappings: Array<{ csvColumn: string; fieldSlug: string }> },
  ) {
    return this.csvService.processImport(importId, appId, user.sub, body.mappings);
  }
}
