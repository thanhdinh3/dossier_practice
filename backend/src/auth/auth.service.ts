import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // Minimal opaque token for the demo: base64 of the user id.
  private makeToken(userId: string): string {
    return Buffer.from(userId, 'utf8').toString('base64');
  }

  decodeToken(token: string): string {
    return Buffer.from(token, 'base64').toString('utf8');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: dto.password,
        role: dto.role,
        displayName: dto.displayName,
      },
    });
    return { token: this.makeToken(user.id), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return { token: this.makeToken(user.id), user: this.publicUser(user) };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ---- Demo only: list all accounts + password-less quick login ----
  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.publicUser(u));
  }

  async quickLogin(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
    return { token: this.makeToken(user.id), user: this.publicUser(user) };
  }

  publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    };
  }
}
