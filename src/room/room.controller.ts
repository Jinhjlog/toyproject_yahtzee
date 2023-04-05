import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create.room.dto';
import { JwtAuthGuardUser } from "../auth/access/jwt.auth.guard.user";

@Controller('api')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  // @Get('/roomHostId')
  // getRoomHostId(@Body() data) {
  //   return this.roomService.getRoomHostId(data);
  // }

  @UseGuards(JwtAuthGuardUser)
  @Post('/createRoom')
  createRoom(@Body() data: CreateRoomDto) {
    return this.roomService.createRoom(data);
  }
}
