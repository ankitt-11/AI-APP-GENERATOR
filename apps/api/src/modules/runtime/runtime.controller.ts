import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RuntimeService } from './runtime.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

/**
 * RuntimeController — single generic controller handling ALL entity types.
 *
 * Routes:
 *   GET  /runtime/:appId/schema          — Full app schema
 *   GET  /runtime/:appId/:entity/schema  — Entity schema (field definitions for UI)
 *   GET  /runtime/:appId/:entity         — List records
 *   GET  /runtime/:appId/:entity/:id     — Get single record
 *   POST /runtime/:appId/:entity         — Create record
 *   PATCH /runtime/:appId/:entity/:id    — Update record
 *   DELETE /runtime/:appId/:entity/:id   — Delete record
 */
@Controller('runtime/:appId')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get('schema')
  getAppSchema(@Param('appId') appId: string) {
    return this.runtimeService.getAppSchema(appId);
  }

  @Get(':entity/schema')
  getEntitySchema(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
  ) {
    return this.runtimeService.getEntitySchema(appId, entity);
  }

  @Get(':entity')
  listRecords(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.runtimeService.listRecords(appId, entity, { page, limit, search, sort, order }, user.sub);
  }

  @Get(':entity/:id')
  getRecord(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.runtimeService.getRecord(appId, entity, id);
  }

  @Post(':entity')
  @HttpCode(HttpStatus.CREATED)
  createRecord(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.runtimeService.createRecord(appId, entity, body, user.sub);
  }

  @Patch(':entity/:id')
  updateRecord(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.runtimeService.updateRecord(appId, entity, id, body, user.sub);
  }

  @Delete(':entity/:id')
  deleteRecord(
    @Param('appId') appId: string,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.runtimeService.deleteRecord(appId, entity, id, user.sub);
  }
}
