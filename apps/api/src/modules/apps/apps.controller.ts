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
import { AppsService } from './apps.service';
import { CreateAppDto, UpdateAppDto } from './dto/app.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.appsService.getDashboardStats(user.sub);
  }

  @Get()
  listApps(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.appsService.listApps(user.sub, page, limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createApp(@CurrentUser() user: JwtPayload, @Body() dto: CreateAppDto) {
    return this.appsService.createApp(user.sub, dto);
  }

  @Get(':appId')
  @UseGuards(OwnershipGuard)
  getApp(@Param('appId') appId: string, @CurrentUser() user: JwtPayload) {
    return this.appsService.getApp(appId, user.sub);
  }

  @Patch(':appId')
  @UseGuards(OwnershipGuard)
  updateApp(
    @Param('appId') appId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAppDto,
  ) {
    return this.appsService.updateApp(appId, user.sub, dto);
  }

  @Delete(':appId')
  @UseGuards(OwnershipGuard)
  @HttpCode(HttpStatus.OK)
  deleteApp(@Param('appId') appId: string, @CurrentUser() user: JwtPayload) {
    return this.appsService.deleteApp(appId, user.sub);
  }

  @Post(':appId/clone')
  @UseGuards(OwnershipGuard)
  @HttpCode(HttpStatus.CREATED)
  cloneApp(@Param('appId') appId: string, @CurrentUser() user: JwtPayload) {
    return this.appsService.cloneApp(appId, user.sub);
  }
}
