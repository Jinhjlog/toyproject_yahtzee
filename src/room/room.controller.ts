import { Body, Controller, Get } from "@nestjs/common";
import { RoomService } from './room.service';

@Controller('api')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('/roomHostId')
  getRoomHostId(@Body() data) {
    return this.roomService.getRoomHostId(data);
  }
}
