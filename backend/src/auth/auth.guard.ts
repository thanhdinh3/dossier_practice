import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { AuthService } from './auth.service';
// User type comes from the generated Prisma client.

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    let userId: string;
    try {
      userId = this.auth.decodeToken(token);
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
    const user = await this.auth.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid token.');
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
