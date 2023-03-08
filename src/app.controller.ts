import { Controller, Get, Param, Query, Render } from "@nestjs/common";
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getHello(): string {
    return '';
  }

  @Get('/room')
  @Render('room')
  getRoom(@Query() roomNum: string) {
    return '';
  }
}
