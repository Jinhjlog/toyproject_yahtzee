import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RoomService {
  constructor(private db: PrismaService) {}

  @Inject()
  private jwtService: JwtService;

  // async getRoomHostId(data) {
  //   const db_data = await this.db.getRoomHostId();
  //   return db_data;
  // }
  async createRoom(data) {
    console.log(data);
    const db_data = await this.db.getRoomHostId();
    await db_data.forEach((list) => {
      if (list.user_id.toString() === data.user_id.toString()) {
        //socket.emit('error', '방 2개 이상 생성 불가');
        return false;
        // bool = false;
      }
    });

    const userInfo = await this.db.getUserInfo({
      user_id: data.user_id,
    });
    // console.log(userInfo);

    // 방 중복생성 예외처리 나중에 주석 해제
    /*
    if (!bool) {
      socket.emit('error', '방 2개 이상 생성 불가');
      throw new Error('error');
    }
    */

    if (data.room_max_user < 2 || data.room_max_user > 4) {
      data.room_max_user = 4;
    }

    const createDB = await this.db.createRoom({
      user_id: data.user_id,
      user_name: userInfo.user_name,
      room_name: data.roomName,
      room_state: 'waiting',
      room_max_user: data.room_max_user,
    });

    return createDB;
  }
}
