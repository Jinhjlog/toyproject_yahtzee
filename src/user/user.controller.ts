import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('api')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/signUp')
  signUp(@Body() data) {
    return this.userService.signUp(data);
  }

  @Post('/signIn')
  signIn(@Body() data) {
    return this.userService.signIn(data);
  }

  @Get('/test')
  test(@Body() data) {
    return this.userService.signIn(data);
  }
}
