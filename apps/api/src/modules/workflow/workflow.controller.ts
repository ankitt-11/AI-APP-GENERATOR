import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

class CreateWorkflowDto {
  @IsString() name: string;
  @IsString() entitySlug: string;
  @IsString() trigger: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsArray() actions: any[];
}

class UpdateWorkflowDto {
  @IsString() @IsOptional() name?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsArray() @IsOptional() actions?: any[];
}

@Controller('apps/:appId/workflows')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  list(@Param('appId') appId: string) {
    return this.workflowService.list(appId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('appId') appId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowService.create(appId, user.sub, dto);
  }

  @Patch(':workflowId')
  update(
    @Param('appId') appId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(appId, workflowId, user.sub, dto);
  }

  @Delete(':workflowId')
  delete(
    @Param('appId') appId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowService.delete(appId, workflowId, user.sub);
  }

  @Get(':workflowId/runs')
  getRuns(
    @Param('workflowId') workflowId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workflowService.getRuns(workflowId, page, limit);
  }
}
