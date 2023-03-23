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
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  @Inject()
  private jwtService: JwtService;

  async handleConnection(socket: Socket) {
    //console.log(this.server.sockets.adapter.rooms);
    socket.emit('refreshRoom', await this.getRoomList());
  }

  async handleDisconnect(socket: Socket) {
    // this.server.emit('refreshRoom', await this.getRoomList());
    //console.log(this.server.sockets.adapter.rooms);
  }

  constructor(private db: PrismaService) {}

  // @SubscribeMessage('setName')
  // async setName(socket: Socket, name) {
  //   socket['nickName'] = name;
  //   console.log(socket['nickName']);
  // }

  @SubscribeMessage('createRoom')
  async createRoom(socket: Socket, payload) {
    // socket 토큰 검증
    // try {
    //   const tokenVerify = await this.socketAuth(socket);
    //   if (tokenVerify === null) {
    //     throw new Error();
    //   }
    // } catch (e) {
    //   socket.emit('tokenError');
    //   throw new Error('토큰 에러(토큰이 만료되었거나 정상 토큰이 아님)');
    // }

    const db_data = await this.db.getRoomHostId();
    //console.log(payload);
    // let bool = true;
    await db_data.forEach((list) => {
      if (list.user_id.toString() === payload.user_id.toString()) {
        socket.emit('error', '방 2개 이상 생성 불가');
        return false;
        // bool = false;
      }
    });

    // 방 중복생성 예외처리 나중에 주석 해제
    /*
    if (!bool) {
      socket.emit('error', '방 2개 이상 생성 불가');
      throw new Error('error');
    }
    */

    if (payload.room_max_user < 2 || payload.room_max_user > 4) {
      payload.room_max_user = 4;
    }
    const createDB = await this.db.createRoom({
      user_id: payload.user_id,
      room_name: payload.roomName,
      room_state: 'waiting',
      room_max_user: payload.room_max_user,
    });

    createDB['role'] = 'host';
    socket.emit('createRoom', createDB);
  }

  @SubscribeMessage('roomListAll')
  async roomList(socket: Socket) {
    socket.emit('refreshRoom', await this.getRoomList());
  }
  //
  // db에서 방 목록 가져오기
  async getRoomList() {
    return this.db.getRoomList();
  }

  private async socketAuth(socket) {
    let result;
    if (socket.handshake.query.token) {
      console.log(
        this.jwtService.verify(socket.handshake.query.token.toString(), {
          secret: 'user',
        }),
      );
      result = this.jwtService.verify(socket.handshake.query.token.toString(), {
        secret: 'user',
      });
    } else {
      result = null;
    }

    return result;
  }

  @SubscribeMessage('findRooms')
  async findRooms(socket: Socket) {
    const data = await this.server.sockets.adapter.sids;
    console.log(data);
    const arr = Array.from(data.keys());
    socket.emit('findRooms', arr);
  }
}
