import { Body, Request, Controller, Get, Post, UseGuards, Put, Delete } from "@nestjs/common";
import { UserService } from './user.service';
import { JwtAuthGuardRefresh } from "../auth/refresh/jwt.auth.guard.refresh";
import { JwtAuthGuardUser } from "../auth/access/jwt.auth.guard.user";

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

  @UseGuards(JwtAuthGuardRefresh)
  @Put('/refreshToken')
  refreshToken(@Body() data, @Request() req) {
    return this.userService.updateToken(req.headers);
  }

  @UseGuards(JwtAuthGuardUser)
  @Delete('/signOut')
  signOut(@Request() req) {
    return this.userService.signOut(req.headers);
  }

  @UseGuards(JwtAuthGuardUser)
  @Get('/test')
  test(@Body() data, @Request() req) {
    return this.userService.updateToken(req.headers);
  }


}
