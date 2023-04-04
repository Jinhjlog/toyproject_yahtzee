import { Body, Controller, Get, Post } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create.room.dto';

@Controller('api')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  // @Get('/roomHostId')
  // getRoomHostId(@Body() data) {
  //   return this.roomService.getRoomHostId(data);
  // }

  @Post('/createRoom')
  createRoom(@Body() data: CreateRoomDto) {
    return this.roomService.createRoom(data);
  }
}
