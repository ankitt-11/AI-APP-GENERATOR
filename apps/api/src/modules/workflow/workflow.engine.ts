import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { WorkflowAction } from '@repo/shared/types';

export interface TriggerContext {
  appId: string;
  entityId: string;
  entitySlug: string;
  recordId: string;
  userId: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>;
}

/**
 * WorkflowEngine — interprets and executes workflow definitions at runtime.
 *
 * Design: Synchronous-first execution.
 * Each action is executed in sequence within the same request lifecycle.
 * WorkflowRun record captures the full result for auditability.
 *
 * Action registry pattern: new action types are registered, not hardcoded.
 */
@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Triggered after every record mutation.
   * Finds all active workflows matching entityId + trigger, then executes them.
   */
  async trigger(trigger: string, context: TriggerContext): Promise<void> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        appId: context.appId,
        trigger,
        isActive: true,
        OR: [
          { entityId: context.entityId },
          { entityId: null },
        ],
      },
    });

    if (workflows.length === 0) return;

    this.logger.log(`Triggering ${workflows.length} workflow(s) for ${trigger} on entity ${context.entitySlug}`);

    // Execute workflows — any failure is captured, never propagated
    await Promise.allSettled(
      workflows.map((workflow) => this.executeWorkflow(workflow, context)),
    );
  }

  private async executeWorkflow(workflow: any, context: TriggerContext): Promise<void> {
    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        status: 'running',
        trigger: context.entitySlug + ':' + workflow.trigger,
        payload: {
          entityId: context.entityId,
          recordId: context.recordId,
          data: context.data,
        } as any,
      },
    });

    const actions = workflow.actions as WorkflowAction[];
    const results: Record<string, unknown>[] = [];

    try {
      for (const action of actions) {
        const result = await this.executeAction(action, context);
        results.push({ action: action.type, result });
      }

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: 'success', result: results as any },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Workflow ${workflow.id} failed: ${errorMessage}`);

      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: errorMessage,
          result: results as any,
        },
      });
    }
  }

  private async executeAction(
    action: WorkflowAction,
    context: TriggerContext,
  ): Promise<unknown> {
    switch (action.type) {
      case 'create_notification':
        return this.actionCreateNotification(action, context);

      case 'create_record':
        return this.actionCreateRecord(action, context);

      case 'log_event':
        return this.actionLogEvent(action, context);

      default:
        this.logger.warn(`Unknown workflow action type: ${action.type}`);
        return { skipped: true, reason: `Unknown action type: ${action.type}` };
    }
  }

  /**
   * Interpolates template strings like "{{record.full_name}}" with actual record data.
   */
  private interpolate(template: string, context: TriggerContext): string {
    return template.replace(/\{\{record\.([^}]+)\}\}/g, (_, fieldSlug) => {
      return String(context.data[fieldSlug] ?? '');
    }).replace(/\{\{entity\}\}/g, context.entitySlug);
  }

  private async actionCreateNotification(action: WorkflowAction, context: TriggerContext) {
    const title = this.interpolate(action.config.title || 'Workflow Executed', context);
    const message = this.interpolate(action.config.message || '', context);

    await this.notifications.create({
      userId: context.userId,
      type: 'workflow_executed',
      title,
      message,
      metadata: {
        appId: context.appId,
        entitySlug: context.entitySlug,
        recordId: context.recordId,
        trigger: context.entitySlug,
      },
    });

    return { notificationCreated: true };
  }

  private async actionCreateRecord(action: WorkflowAction, context: TriggerContext) {
    if (!action.config.entitySlug) {
      return { skipped: true, reason: 'No entitySlug provided' };
    }

    const targetEntity = await this.prisma.entity.findFirst({
      where: {
        slug: action.config.entitySlug,
        app: { id: context.appId },
      },
    });

    if (!targetEntity) {
      return { skipped: true, reason: `Entity "${action.config.entitySlug}" not found` };
    }

    // Interpolate data values
    const data = Object.fromEntries(
      Object.entries(action.config.data || {}).map(([k, v]) => [k, this.interpolate(v as string, context)]),
    );

    const record = await this.prisma.entityRecord.create({
      data: { entityId: targetEntity.id, data },
    });

    return { recordCreated: true, recordId: record.id };
  }

  private async actionLogEvent(action: WorkflowAction, context: TriggerContext) {
    const message = this.interpolate(action.config.message || 'Workflow event', context);
    const level = action.config.level || 'info';

    await this.prisma.auditLog.create({
      data: {
        userId: context.userId,
        action: 'workflow_run',
        resource: 'entities',
        resourceId: context.entityId,
        after: { message, level, entitySlug: context.entitySlug, recordId: context.recordId },
      },
    });

    return { logged: true, message, level };
  }
}
