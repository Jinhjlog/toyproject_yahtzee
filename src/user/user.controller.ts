import {
  Body,
  Request,
  Controller,
  Get,
  Post,
  UseGuards,
  Put,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuardRefresh } from '../auth/refresh/jwt.auth.guard.refresh';
import { JwtAuthGuardUser } from '../auth/access/jwt.auth.guard.user';
import { SignInUserDto } from './dto/sign-In.user.dto';
import { SignUpUserDto } from './dto/sign-up.user.dto';

@Controller('api')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/signUp')
  signUp(@Body() data: SignUpUserDto) {
    return this.userService.signUp(data);
  }

  @Post('/signIn')
  signIn(@Body() data: SignInUserDto) {
    return this.userService.signIn(data);
  }

  @UseGuards(JwtAuthGuardRefresh)
  @Put('/refreshToken')
  refreshToken(@Request() req) {
    return this.userService.updateToken(req.headers);
  }

  @UseGuards(JwtAuthGuardRefresh)
  @Put('/getAccessToken')
  getAccessToken(@Request() req) {
    return this.userService.getAccessToken(req.headers);
  }

  @UseGuards(JwtAuthGuardUser)
  @Put('/getRefreshToken')
  getRefreshToken(@Request() req) {
    return this.userService.getRefreshToken(req.headers);
  }

  @Delete('/signOut')
  signOut(@Request() req) {
    return this.userService.signOut(req.headers);
  }

  @Get('/test')
  test(@Body() data) {
    return this.userService.test(data);
  }
}
