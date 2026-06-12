import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — apply to any route that requires authentication.
 * Automatically extracts Bearer token, verifies via JwtStrategy,
 * and populates request.user with JwtPayload.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
