import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check for existing user
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'register',
        resource: 'users',
        resourceId: user.id,
        after: { email: user.email, name: user.name },
      },
    });

    const accessToken = this.generateToken({ sub: user.id, email: user.email, name: user.name ?? undefined });

    return { user, accessToken };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      // Constant-time comparison to prevent user enumeration via timing attacks
      await bcrypt.hash('dummy_password_to_prevent_timing', BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User logged in: ${user.email}`);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        resource: 'users',
        resourceId: user.id,
      },
    });

    const accessToken = this.generateToken({ sub: user.id, email: user.email, name: user.name ?? undefined });

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      accessToken,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async updateProfile(userId: string, data: { name?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  private generateToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }
}
