import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

/**
 * OwnershipGuard ensures the authenticated user owns the :appId resource.
 *
 * It reads :appId from route params, queries the DB with BOTH id AND ownerId,
 * and rejects if no matching record is found.
 *
 * This is the single point of ownership enforcement across all app-scoped routes.
 * It prevents horizontal privilege escalation (user A accessing user B's app).
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const appId = request.params?.appId;

    // Routes without :appId don't need ownership check
    if (!appId) return true;

    const app = await this.prisma.app.findFirst({
      where: { id: appId, ownerId: user.sub },
      select: { id: true },
    });

    if (!app) {
      // Return 404 instead of 403 to avoid leaking resource existence
      throw new NotFoundException('Application not found');
    }

    // Attach app to request for downstream use
    request.app = app;
    return true;
  }
}
