import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PlayWsEntity } from './entities/play-ws.entity';
import { rootLogger } from 'ts-jest';

@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsPlayAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection() {
    console.log(this.server.sockets.adapter.rooms);
  }

  handleDisconnect() {
    // 방장이 방에서 나간 것을 확인
    // > 방장이 나간 방의 번호를 확인
    // > 나간 방의 유저 목록을 불러옴
    // > leave 써서 다 내보내고 목록 페이지로 강제로 내보냄
    // > 데이터베이스에 있는 방 목록 삭제
    // > entity에 있는 배열 삭제

    console.log(this.server.sockets.adapter.rooms);
  }

  private playInfo: PlayWsEntity[] = [];
  //  private roomInfo: RoomInfo[] = [];

  constructor(private db: PrismaService) {}

  private;
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    this.server.sockets.emit('refreshRoom', await this.db.getRoomList());

    this.playInfo.push({
      roomNumber: data.roomNumber,
      userInfo: [
        new Map([
          [
            data.userName,
            {
              userName: 'host',
              userState: 'none',
            },
          ],
        ]),
      ],
      userList: [data.userName],
    });

    //console.log(this.playInfo);
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    //console.log(socket.rooms);
    const name = socket['nickName'];
    //console.log(socket['nickName']);
    socket
      .to(data.roomNumber)
      .emit('userJoinRoom', `${name}님이 입장하셨습니다!`);
  }

  @SubscribeMessage('savePlayInfo')
  async savePlayInfo(socket: Socket, data) {
    let index;
    // await this.playInfo.forEach((list) => {
    //   if (list.roomNumber == data.roomNumber) {
    //     index = list.roomNumber;
    //   }
    // });

    for (let i = 0; i < this.playInfo.length; i++) {
      if (this.playInfo[i].roomNumber == data.roomNumber) {
        index = i;
      }
    }
    this.playInfo[index].userInfo.push(
      new Map([
        [
          data.userName,
          {
            userName: data.userName,
            userState: 'none',
          },
        ],
      ]),
    );
    this.playInfo[index].userList.push(data.userName);
    // console.log(this.playInfo[index]);
    // console.log(this.playInfo[index].userInfo);
  }

  @SubscribeMessage('serverConsoleView')
  async serverConsoleView(socket: Socket, data) {
    console.log(this.server.sockets.adapter.rooms.get(data));
  }
}
