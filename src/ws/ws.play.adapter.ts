import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { GameSetWsEntity } from './entities/game-set-ws.entity';
import { rootLogger } from 'ts-jest';
import { Inject } from '@nestjs/common';
import { WsAdapter } from './ws.adapter';
import { GamePlayWsEntity } from './entities/game-play-ws.entity';

@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsPlayAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  @Inject()
  private adapter: WsAdapter;

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
      await this.roomInfo.forEach((info) => {
        for (let i = 0; i < info.userInfo.length; i++) {
          if (info.userInfo[i]['userId'] == socket['userId']) {
            socket.to(info.roomNumber.toString()).emit('disconnectHost');
            this.roomInfo.splice(index, 1);
            roomNumber = info.roomNumber;
          }
        }
        index++;
      });
      await this.db.deleteRoom(roomNumber);
      this.server.sockets.emit('refreshRoom', await this.db.getRoomList());
    } else if (socket['userRole'] === 'user') {
      // 유저가 방을 나갔을 때 roomInfo에 있는 유저 정보를 삭제
      let index = 0;
      this.roomInfo.forEach((info) => {
        for (let i = 0; i < info.userList.length; i++) {
          if (info.userList[i] === socket['userId']) {
            this.roomInfo[index].userList.splice(i, 1);
            this.roomInfo[index].userInfo.splice(i, 1);
            userRoomNumber = this.roomInfo[index].roomNumber;
          }
        }
        index++;
      });

      let gameInfoIdx = 0;
      for (let i = 0; i < this.gameInfo.length; i++) {
        if (this.gameInfo[i].roomNumber == userRoomNumber) {
          gameInfoIdx = i;
        }
      }
      console.log(gameInfoIdx);

      try {
        const roomInfoIdx = this.getMyRoomIdx(userRoomNumber);
        //console.log(roomInfoIdx);

        socket
          .to(userRoomNumber.toString())
          .emit(
            'disconnectUser',
            `${socket['userName']}이(가) 퇴장하셨습니다.`,
          );
        socket
          .to(this.roomInfo[roomInfoIdx].roomNumber.toString())
          .emit('refreshUserList', this.roomInfo[roomInfoIdx]);
      } catch (e) {}
    }
  }

  private roomInfo: GameSetWsEntity[] = [];
  private gameInfo: GamePlayWsEntity[] = [];
  constructor(private db: PrismaService) {}

  // 방 생성
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data) {
    socket['userId'] = data.userId;
    socket['userRole'] = data.userRole;
    socket['userName'] = data.userName;
    socket.join(data.roomNumber);
    this.server.sockets.emit('refreshRoom', await this.db.getRoomList());

    this.roomInfo.push({
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

      userList: [data.userId],
    });
    const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);
    socket.emit('refreshUserList', this.roomInfo[roomInfoIdx]);
  }

  // user 방 입장
  @SubscribeMessage('joinRoom')
  async joinRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
  }

  // 유저 정보를 방목록 별로 저장
  @SubscribeMessage('setPlayInfo')
  async savePlayInfo(socket: Socket, data) {
    let index;

    socket['userId'] = data.userId;
    socket['userRole'] = data.userRole;
    socket['userName'] = data.userName;

    for (let i = 0; i < this.roomInfo.length; i++) {
      if (this.roomInfo[i].roomNumber == data.roomNumber) {
        index = i;
      }
    }
    this.roomInfo[index].userInfo.push({
      socId: [...socket.rooms][0],
      userId: data.userId,
      userName: data.userName,
      userState: 'none',
      userRole: 'user',
    });
    this.roomInfo[index].userList.push(data.userId);
    socket
      .to(data.roomNumber)
      .emit('userJoinRoom', `${data.userName} 님이 입장하셨습니다.`);

    const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);

    this.server.sockets
      .in(data.roomNumber)
      .emit('refreshUserList', this.roomInfo[roomInfoIdx]);
  }

  // 유저 준비 버튼 클릭 시
  @SubscribeMessage('setUserReady')
  async setUserReady(socket: Socket, data) {
    const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);

    for (let i = 0; i < this.roomInfo[roomInfoIdx].userInfo.length; i++) {
      if (
        this.roomInfo[roomInfoIdx].userInfo[i]['userId'] == socket['userId']
      ) {
        this.roomInfo[roomInfoIdx].userInfo[i]['userState'] == 'none'
          ? (this.roomInfo[roomInfoIdx].userInfo[i]['userState'] = 'ready')
          : (this.roomInfo[roomInfoIdx].userInfo[i]['userState'] = 'none');
        this.server.sockets
          .in(data.roomNumber)
          .emit('refreshUserList', this.roomInfo[roomInfoIdx]);
      }
    }
  }

  // host 게임 시작 버튼 클릭 시
  @SubscribeMessage('hostGameStart')
  async hostGameStart(socket: Socket, data) {
    const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);

    if (
      socket['userRole'] == 'host' &&
      this.roomInfo[roomInfoIdx].userInfo.length >= 2
    ) {
      const noneList = [];
      let bool = true;
      this.roomInfo[roomInfoIdx].userInfo.forEach((list) => {
        if (list['userState'] != 'ready') {
          noneList.push(list['userName']);
          bool = false;
        }
      });

      bool
        ? (this.server.sockets.in(data.roomNumber).emit('gameStart', '시작'),
          await this.db.startGame(Number(data.roomNumber)),
          this.server.sockets.emit(
            'refreshRoom',
            await this.adapter.getRoomList(),
          ),
          await this.setGamePlayInfo({
            roomInfoIdx: roomInfoIdx,
            roomNumber: data.roomNumber,
          }))
        : this.server.sockets.in(data.roomNumber).emit('gameStart', noneList);
    }
  }

  @SubscribeMessage('serverConsoleView')
  async serverConsoleView(socket: Socket, data) {
    //console.log('host:', [...this.server.sockets.adapter.rooms.get(data)][0]);
    //console.log('------------------------------------------');
    //console.log([...socket.rooms][0]);
    // console.log(this.roomInfo);
    // console.log(this.roomInfo[0].userInfo);
    console.log(this.gameInfo);
    this.gameInfo.forEach((list) => {
      console.log(list.userPlayInfo);
      console.log(list.userYahtScore);
    });

    //console.log(this.roomInfo[0].userInfo);
  }

  getMyRoomIdx(roomNumber) {
    let roomInfoIdx = 0;
    for (let i = 0; i < this.roomInfo.length; i++) {
      if (this.roomInfo[i].roomNumber == roomNumber) {
        roomInfoIdx = i;
      }
    }
    return roomInfoIdx;
  }

  async setGamePlayInfo(data) {
    const playUserInfo = this.roomInfo[data.roomInfoIdx];

    //console.log(playUserInfo);
    // const playUserInfo = this.roomInfo[data.roomInfo];
    // const userInfo = playUserInfo.userInfo;
    const userPlayInfoArray = [];
    const userPlayScoreArray = [];
    let gameBool = true;

    await this.gameInfo.forEach((list) => {
      if (list.roomNumber == data.roomNumber) {
        gameBool = false;
      }
    });

    if (!gameBool) return;

    console.log('진행');
    for (let i = 0; i < playUserInfo.userList.length; i++) {
      userPlayInfoArray.push({
        userId: playUserInfo.userInfo[i]['userId'],
        userName: playUserInfo.userInfo[i]['userName'],
        userScore: 0,
      });

      userPlayScoreArray.push({
        userId: playUserInfo.userInfo[i]['userId'],
        ones: 0,
        twos: 0,
        threes: 0,
        fours: 0,
        fives: 0,
        sixes: 0,
        bonus: 0,
        triple: 0,
        four_card: 0,
        full_house: 0,
        small_straight: 0,
        large_straight: 0,
        Chance: 0,
        Yahtzee: 0,
        Yahtzee_bonus: 0,
      });
    }

    this.gameInfo.push({
      roomNumber: this.roomInfo[data.roomInfoIdx].roomNumber,
      userPlayInfo: [userPlayInfoArray],
      userDiceTurn: this.roomInfo[data.roomInfoIdx].userList,
      userYahtScore: [userPlayScoreArray],
    });

    console.log(this.gameInfo);
  }
}

interface gameScoreInfo {
  userId: string;
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  fives: number;
  sixes: number;
  bonus: number;
  triple: number;
  four_card: number;
  full_house: number;
  small_straight: number;
  large_straight: number;
  Chance: number;
  Yahtzee: number;
  Yahtzee_bonus: number;
}
