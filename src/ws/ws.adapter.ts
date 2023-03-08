import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomInfo } from './entities/room-ws.entity';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsAdapter
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  afterInit(socket: Socket) {
    socket['nickName'] = 'anon';
  }

  handleConnection(socket: Socket) {
    //console.log(this.server.sockets.adapter.rooms);
  }

  handleDisconnect(socket: Socket) {
    //console.log(this.server.sockets.adapter.rooms);
  }

  private roomInfo: RoomInfo[] = [];

  constructor(private db: PrismaService) {}

  @SubscribeMessage('setName')
  async setName(socket: Socket, name) {
    socket['nickName'] = name;
    console.log(socket['nickName']);
  }

  @SubscribeMessage('createRoom')
  async createRoom(socket: Socket, payload) {
    const db_data = await this.db.getRoomHostId();
    //console.log(payload);
    let bool = true;
    await db_data.forEach((list) => {
      if (list.user_id.toString() === payload.user_id.toString()) {
        bool = false;
      }
    });

    /*// 방 중복생성 예외처리 나중에 주석 해제
    if (!bool) {
      socket.emit('error', '방 2개 이상 생성 불가');
      throw new UnauthorizedException('roomError');
    }*/

    const createDB = await this.db.createRoom({
      user_id: payload.user_id,
      room_name: payload.roomName,
      room_state: 'waiting',
    });

    createDB['role'] = 'host';
    socket.emit('createRoom', createDB);
  }

  /*
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    console.log('방만듦');
    this.server.sockets.emit('refreshRoom', await this.getRoomList());
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    //console.log(socket.rooms);
    const name = socket['nickName'];
    console.log(socket['nickName']);
    socket
      .to(data.roomNumber)
      .emit('userJoinRoom', `${name}님이 입장하셨습니다!`);
  }*/

  @SubscribeMessage('roomListAll')
  async roomList(socket: Socket) {
    socket.emit('refreshRoom', await this.getRoomList());
  }

  // db에서 방 목록 가져오기
  async getRoomList() {
    return this.db.getRoomList();
  }

}
