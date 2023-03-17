import { IsString } from 'class-validator';

export class SignInUserDto {
  @IsString()
  readonly user_email: string;

  @IsString()
  readonly user_pw: string;
}
