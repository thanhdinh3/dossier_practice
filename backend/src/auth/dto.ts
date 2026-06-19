import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['EMPLOYER', 'CANDIDATE'])
  role: 'EMPLOYER' | 'CANDIDATE';

  @IsString()
  @MinLength(1)
  displayName: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class QuickLoginDto {
  @IsString()
  @MinLength(1)
  userId: string;
}
