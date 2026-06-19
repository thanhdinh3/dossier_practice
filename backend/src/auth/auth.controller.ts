import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { LoginDto, QuickLoginDto, RegisterDto } from './dto';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Demo only: list accounts + click-to-login without a password.
  @Get('users')
  listUsers() {
    return this.auth.listUsers();
  }

  @Post('quick-login')
  quickLogin(@Body() dto: QuickLoginDto) {
    return this.auth.quickLogin(dto.userId);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.publicUser(user);
  }
}
