import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Controller('apps/:appId/metadata')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  listVersions(@Param('appId') appId: string) {
    return this.metadataService.listVersions(appId);
  }

  @Get('active')
  getActiveMetadata(@Param('appId') appId: string) {
    return this.metadataService.getActiveMetadata(appId);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validateOnly(@Body() body: { definition: unknown }) {
    return this.metadataService.validateOnly(body.definition);
  }

  @Post('save')
  @HttpCode(HttpStatus.CREATED)
  saveVersion(
    @Param('appId') appId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { definition: unknown; changelog?: string },
  ) {
    return this.metadataService.saveVersion(appId, user.sub, body.definition, body.changelog);
  }

  @Post(':versionId/publish')
  @HttpCode(HttpStatus.OK)
  publishVersion(
    @Param('appId') appId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.metadataService.publishVersion(appId, user.sub, versionId);
  }
}
