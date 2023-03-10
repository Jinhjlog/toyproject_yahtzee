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

  handleConnection(socket: Socket) {
    //console.log(this.server.sockets.adapter.rooms);
  }

  async handleDisconnect(socket: Socket) {
    // 방장이 방에서 나간 것을 확인
    // > 방장이 나간 방의 번호를 확인
    // > 나간 방의 유저 목록을 불러옴
    // > leave 써서 다 내보내고 목록 페이지로 강제로 내보냄
    // > 데이터베이스에 있는 방 목록 삭제
    // > entity에 있는 배열 삭제
    let userRoomNumber = 0;
    // host가 방을 나가면 전부 방을 나가게 함
    if (socket['userRole'] === 'host') {
      let index = 0;
      let roomNumber = 0;
      await this.playInfo.forEach((info) => {
        for (let i = 0; i < info.userInfo.length; i++) {
          if (info.userInfo[i]['userId'] == socket['userId']) {
            socket.to(info.roomNumber.toString()).emit('disconnectHost');
            this.playInfo.splice(index, 1);
            roomNumber = info.roomNumber;
          }
          // if (info.userInfo[i].get(socket['userId'])) {
          //   console.log(info.roomNumber);
          //   socket.to(info.roomNumber.toString()).emit('disconnectHost');
          //   console.log(this.playInfo[index]);
          //   this.playInfo.splice(index, 1);
          //   roomNumber = info.roomNumber;
          // }
        }
        index++;
      });
      await this.db.deleteRoom(roomNumber);
      this.server.sockets.emit('refreshRoom', await this.db.getRoomList());
    } else if (socket['userRole'] === 'user') {
      // 유저가 방을 나갔을 때 roomInfo에 있는 유저 정보를 삭제
      let index = 0;
      this.playInfo.forEach((info) => {
        // console.log('------------user------------');
        // console.log(info);

        for (let i = 0; i < info.userList.length; i++) {
          if (info.userList[i] === socket['userId']) {
            this.playInfo[index].userList.splice(i, 1);
            this.playInfo[index].userInfo.splice(i, 1);
            userRoomNumber = this.playInfo[index].roomNumber;
          }
        }
        index++;
      });

      try {
        const playInfoIdx = this.getMyRoomIdx(userRoomNumber);
        //console.log(playInfoIdx);
        socket
          .to(userRoomNumber.toString())
          .emit(
            'disconnectUser',
            `${socket['userName']}이(가) 방을 나갔습니다.`,
          );
        socket
          .to(this.playInfo[playInfoIdx].roomNumber.toString())
          .emit('refreshUserList', this.playInfo[playInfoIdx]);
      } catch (e) {}
    }
    // console.log(this.server.sockets.adapter.rooms);
    // socket.rooms.forEach((room) => socket.to(room).emit('bye'));
    // console.log(this.server.sockets.adapter.rooms);
  }

  private playInfo: PlayWsEntity[] = [];
  //  private roomInfo: RoomInfo[] = [];

  constructor(private db: PrismaService) {}

  // 방 생성
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data) {
    socket['userId'] = data.userId;
    socket['userRole'] = data.userRole;
    socket['userName'] = data.userName;
    socket.join(data.roomNumber);
    this.server.sockets.emit('refreshRoom', await this.db.getRoomList());

    this.playInfo.push({
      roomNumber: data.roomNumber,
      userInfo: [
        {
          socId: [...socket.rooms][0],
          userId: data.userId,
          userName: data.userName,
          userState: 'ready',
          userRole: 'host',
        },
      ],
      // userInfo: [
      //   new Map([
      //     [
      //       data.userId,
      //       {
      //         socId: [...socket.rooms][0],
      //         userId: data.userId,
      //         userName: data.userName,
      //         userState: 'none',
      //       },
      //     ],
      //   ]),
      // ],
      userList: [data.userId],
    });
    const playInfoIdx = this.getMyRoomIdx(data.roomNumber);
    socket.emit('refreshUserList', this.playInfo[playInfoIdx]);
  }

  // user 방 입장
  @SubscribeMessage('joinRoom')
  async joinRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    // const name = socket['nickName'];
    // socket
    //   .to(data.roomNumber)
    //   .emit('userJoinRoom', `${name}님이 입장하셨습니다!`);
  }

  // 유저 정보를 방목록 별로 저장
  @SubscribeMessage('setPlayInfo')
  async savePlayInfo(socket: Socket, data) {
    let index;
    // await this.playInfo.forEach((list) => {
    //   if (list.roomNumber == data.roomNumber) {
    //     index = list.roomNumber;
    //   }
    // });

    socket['userId'] = data.userId;
    socket['userRole'] = data.userRole;
    socket['userName'] = data.userName;

    for (let i = 0; i < this.playInfo.length; i++) {
      if (this.playInfo[i].roomNumber == data.roomNumber) {
        index = i;
      }
    }
    this.playInfo[index].userInfo.push(
      {
        socId: [...socket.rooms][0],
        userId: data.userId,
        userName: data.userName,
        userState: 'none',
        userRole: 'user',
      },
      // new Map([
      //   [
      //     data.userId,
      //     {
      //       socId: [...socket.rooms][0],
      //       userId: data.userId,
      //       userName: data.userName,
      //       userState: 'none',
      //     },
      //   ],
      // ]),
    );
    this.playInfo[index].userList.push(data.userId);

    //'a' 라는 방에 있는 사람 중에 송신한 사람을 뺀 모두에게 보내기
    //socket.broadcast.to('a').emit('message', '안녕');

    //io.sockets.in('a').emit('message', '안녕');
    socket
      .to(data.roomNumber)
      .emit('userJoinRoom', `${data.userName} 님이 입장하셨습니다.`);

    // playInfoIdx : 현재 내가 들어와있는 방의 playInfo array Index를 저장
    // let playInfoIdx = 0;
    // for (let i = 0; i < this.playInfo.length; i++) {
    //   if (this.playInfo[i].roomNumber == data.roomNumber) {
    //     playInfoIdx = i;
    //   }
    // }

    const playInfoIdx = this.getMyRoomIdx(data.roomNumber);

    this.server.sockets
      .in(data.roomNumber)
      .emit('refreshUserList', this.playInfo[playInfoIdx]);
  }

  @SubscribeMessage('serverConsoleView')
  async serverConsoleView(socket: Socket, data) {
    //console.log('host:', [...this.server.sockets.adapter.rooms.get(data)][0]);
    //console.log('------------------------------------------');
    //console.log([...socket.rooms][0]);
    console.log(this.playInfo);
    //console.log(this.playInfo[0].userInfo);
  }

  getMyRoomIdx(roomNumber) {
    let playInfoIdx = 0;
    for (let i = 0; i < this.playInfo.length; i++) {
      if (this.playInfo[i].roomNumber == roomNumber) {
        playInfoIdx = i;
      }
    }
    //console.log('playInfo room number', this.playInfo[0].roomNumber);
    //console.log('roomNumber', roomNumber);
    return playInfoIdx;
  }
}
