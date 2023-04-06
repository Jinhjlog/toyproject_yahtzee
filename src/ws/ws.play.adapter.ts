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
import { Inject } from '@nestjs/common';
import { WsAdapter } from './ws.adapter';
import { GamePlayWsEntity } from './entities/game-play-ws.entity';
import { CreateRoomWsPlayDto } from './dto/create-room.ws.play.dto';
import { PutDiceWsPlayDto } from './dto/put-dice.ws.play.dto';
import { SaveScoreWsPlayDto } from './dto/save-score.ws.play.dto';
import { WsPlayService } from './ws.play.service';
import { Interval } from '@nestjs/schedule';

@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsPlayAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  @Inject()
  private adapter: WsAdapter;

  @Inject()
  private service: WsPlayService;

  // @Inject()
  // private jwtService: JwtService;
  handleConnection(socket: Socket) {
    //console.log(this.server.sockets.adapter.rooms);
    // console.log(socket.handshake.query.token);
    // if (socket.handshake.query.token) {
    //   try {
    //     console.log(
    //       this.jwtService.verify(socket.handshake.query.token.toString(), {
    //         secret: 'user',
    //       }),
    //     );
    //   } catch (e) {
    //     console.log('토큰 에러')
    //   }
    // }
  }

  async handleDisconnect(socket: Socket) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });
    let diceTurnResult = null;

    if (socket['userRole'] !== undefined) {
      /*
       * 주사위 턴 이탈한 유저 확인 및 정리
       * */
      diceTurnResult = await this.service.diceTurnRefresh(
        socket,
        this.gameInfo,
        gameInfoIdx,
      );

      console.log('room에 접속한 유저 ');
      await this.service.removeRoomInfo(this.roomInfo, roomNumIdx);
      await this.service.removeGameInfo(this.gameInfo, gameInfoIdx, socket);

      /*
       * 게임 인원이 1명인지 체크
       * */
      const tempBool = await this.service.gamePlayUserCheck(
        this.gameInfo,
        gameInfoIdx,
      );

      /*
       * 게임 인원이 1명이라면 남은 인원이 게임을 승리하고 종료
       * */
      const result = await this.service.gameEndMethod(
        this.gameInfo,
        gameInfoIdx,
        roomNumIdx,
        tempBool,
      );

      /*
       * 점수별 순위 내림차순 전달
       * */
      if (result) {
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('gameEnd', result.reverse());
      }
    }

    if (socket['userRole'] === 'host') {
      // /*
      //  * 게임 인원이 1명인지 체크
      //  * */
      // const tempBool = await this.service.gamePlayUserCheck(
      //   this.gameInfo,
      //   gameInfoIdx,
      // );
      //
      // /*
      //  * 게임 인원이 1명이라면 남은 인원이 게임을 승리하고 종료
      //  * */
      // const result = await this.service.gameEndMethod(
      //   this.gameInfo,
      //   gameInfoIdx,
      //   roomNumIdx,
      //   tempBool,
      // );

      // /*
      //  * 점수별 순위 내림차순 전달
      //  * */
      // if (result) {
      //   this.server.sockets
      //     .in(roomNumIdx.roomNumber.toString())
      //     .emit('gameEnd', result.reverse());
      // }

      /*
       * 방장을 넘김
       * */
      try {
        this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['userRole'] = 'host';
        await this.db.changeHost({
          roomId: roomNumIdx.roomNumber,
          userId: this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['userId'],
          user_name:
            this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['userName'],
        });
        this.server.sockets
          .in(this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['socId'])
          .emit('changeHost');
      } catch (e) {
        console.log('db에러');
      }

      try {
        await this.db.userQuitRoom(Number(roomNumIdx.roomNumber));
      } catch (e) {}

      /*
       * 방 목록 새로고침
       * */
      // this.server.sockets.emit('refreshRoom', await this.db.getRoomList());
    } else if (socket['userRole'] === 'user') {
      // await this.service.removeRoomInfo(this.roomInfo, roomNumIdx);
      // await this.service.removeGameInfo(this.gameInfo, gameInfoIdx, socket);

      // /*
      //  * 게임 인원이 1명인지 체크
      //  * */
      // const tempBool = await this.service.gamePlayUserCheck(
      //   this.gameInfo,
      //   gameInfoIdx,
      // );
      //
      // /*
      //  * 게임 인원이 1명이라면 남은 인원이 게임을 승리하고 종료
      //  * */
      // const result = await this.service.gameEndMethod(
      //   this.gameInfo,
      //   gameInfoIdx,
      //   roomNumIdx,
      //   tempBool,
      // );
      //
      // /*
      //  * 점수별 순위 내림차순 전달
      //  * */
      // if (result) {
      //   this.server.sockets
      //     .in(roomNumIdx.roomNumber.toString())
      //     .emit('gameEnd', result.reverse());
      // }

      try {
        await this.db.userQuitRoom(Number(roomNumIdx.roomNumber));
        this.server.emit('refreshRoom', await this.db.getRoomList());
        socket.to(roomNumIdx.roomNumber.toString()).emit('disconnectUser', {
          message: `${socket['userName']}이(가) 퇴장하셨습니다.`,
        });
        socket
          .to(this.roomInfo[roomNumIdx.roomInfoIdx].roomNumber.toString())
          .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
      } catch (e) {
        console.log('host가 방에서 떠남');
      }
    }

    if (diceTurnResult) {
      try {
        this.server.in(roomNumIdx.roomNumber.toString()).emit('diceTurn', {
          message: 'diceTurn',
          diceTurn: this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0], // 현재 주사위 턴 유저 전달
          diceTurnName: await this.service.getDiceTurnName(
            this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0],
            this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo,
          ),
        });
      } catch (e) {
        console.log('게임이 시작되지 않음');
      }
    }
    // console.log(socket['userRole'])

    // refactor deleteEmptyRoom
    await this.service.deleteEmptyRoom(this.roomInfo, this.gameInfo);
    this.server.emit('refreshRoom', await this.db.getRoomList());
  }

  private roomInfo: GameSetWsEntity[] = [];
  private gameInfo: GamePlayWsEntity[] = [];
  constructor(private db: PrismaService) {}

  // 방 생성
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data: CreateRoomWsPlayDto) {
    /*
     * 유저의 소켓에 userId, userRole, userName을 저장함
     * */
    socket['userId'] = data.userId;
    socket['userRole'] = 'host';
    socket['userName'] = data.userName;

    /*
     * 방번호에 해당하는 room에 join함
     * */
    socket.join(data.roomNumber.toString());

    /*
     * 방 목록 새로고침
     * */
    this.server.sockets.emit('refreshRoom', await this.db.getRoomList());

    /*
     * roomInfo 배열에 host 데이터 저장
     * */
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
    //const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    socket.emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
  }

  // user 방 입장
  @SubscribeMessage('joinRoom')
  async joinRoom(socket: Socket, data: CreateRoomWsPlayDto) {
    const roomInfo = await this.db.findRoom(Number(data.roomNumber));

    console.log(roomInfo);
    // console.log(data);
    socket.join(data.roomNumber.toString());

    if (
      this.server.sockets.adapter.rooms.get(data.roomNumber.toString()).size >
        roomInfo.room_max_user ||
      roomInfo.room_state == 'start'
    ) {
      socket.emit('joinError');
      console.log('인원수 초과');
      return false;
    }

    await this.service.savePlayInfo(socket, this.roomInfo, data);
    this.server.emit('refreshRoom', await this.db.getRoomList());
    socket.to(data.roomNumber.toString()).emit('userJoinRoom', {
      joinUserName: data.userName,
      message: `${data.userName} 님이 입장하셨습니다.`,
    });

    const roomNumIdx = await this.findUserRoom(socket['userId']);

    /*
     * 방에 참여중인 유저 새로고침
     * */
    this.server.sockets
      .in(data.roomNumber.toString())
      .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
  }
  @SubscribeMessage('gameReadyBtn')
  async hostGameStart(socket: Socket) {
    switch (socket['userRole']) {
      case 'host':
        const hostResult = await this.service.hostGameStartBtn(
          socket,
          this.roomInfo,
        );
        hostResult.bool
          ? (this.server.sockets
              .in(hostResult.roomNumIdx.roomNumber.toString())
              .emit('gameStart', { message: '게임 시작', state: 1 }),
            await this.db.startGame(Number(hostResult.roomNumIdx.roomNumber)),
            this.server.sockets.emit(
              'refreshRoom',
              await this.adapter.getRoomList(),
            ),
            await this.service.setGamePlayInfo(
              socket,
              this.roomInfo,
              this.gameInfo,
              {
                roomInfoIdx: hostResult.roomNumIdx.roomInfoIdx,
                roomNumber: hostResult.roomNumIdx.roomNumber,
              },
            ),
            this.server
              .in(hostResult.roomNumIdx.roomNumber.toString())
              .emit('diceTurn', {
                message: 'diceTurn',
                diceTurn:
                  this.roomInfo[hostResult.roomNumIdx.roomInfoIdx].userList[0],
                diceTurnName: socket['userName'],
              }))
          : this.server.sockets
              .in(hostResult.roomNumIdx.roomNumber.toString())
              .emit('gameStart', {
                message: '게임 시작 실패',
                state: 0,
                noneList: hostResult.noneList,
              });
        break;
      case 'user':
        const userResult = await this.service.userGameReadyBtn(
          socket,
          this.roomInfo,
        );
        /*
         * room에 참여중인 user 업데이트
         * */
        this.server.sockets
          .in(userResult.roomNumIdx.roomNumber.toString())
          .emit(
            'refreshUserList',
            this.roomInfo[userResult.roomNumIdx.roomInfoIdx],
          );
        break;
      default:
        return false;
    }
  }

  @SubscribeMessage('serverConsoleView')
  async serverConsoleView(socket: Socket, data) {
    // console.log(this.gameInfo);
    // this.gameInfo.forEach((list) => {
    //   console.log(list.userPlayInfo);
    //   console.log(list.gameRound);
    // });
    // console.log(this.gameInfo);
    // console.log(this.roomInfo);
    // this.gameInfo.forEach((data) => {
    //   console.log(data.userDiceTurn);
    // });
    // this.gameInfo.forEach((data) => {
    //   console.log(data);
    // });
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    console.log(this.roomInfo);
    console.log('=--------------------------=');
    console.log(this.roomInfo[roomNumIdx.roomInfoIdx].userInfo);
    console.log('===================================================');
    console.log(this.gameInfo);
    console.log('=--------------------------=');
    console.log(this.gameInfo[gameInfoIdx.gameInfoIdx]);
  }
  /*
   * 사용자가 주사위를 던졌을 때
   * */
  @SubscribeMessage('throwDice')
  async throwDice(socket: Socket) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    if (
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] == socket['userId']
    ) {
      if (!this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice']) {
        socket.emit('throwDice', {
          state: 0,
          message: `주사위는 한번 만 던질 수 있음`,
        });
      } else {
        const diceResult = await this.service.userThrowDice();
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('throwDice', {
            state: 1,
            message: `${socket['userId']} 이(가) 주사위를 던짐`,
            diceResult: diceResult,
            scoreBoard: await this.service.refreshScoreBoard(
              socket,
              this.roomInfo,
              this.gameInfo,
              {
                diceResult: diceResult,
                userId: socket['userId'],
                gameInfoIdx: gameInfoIdx.gameInfoIdx,
                roomNumber: roomNumIdx.roomNumber,
              },
            ),
            diceCount:
              this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'],
          });
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = false;
      }
    } else {
      socket.emit('throwDice', {
        state: 0,
        message: `${
          await this.service.getDiceTurnName(
            this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0],
            this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo,
          )
          // this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0]
        }의 턴`,
      });
    }
  }

  /*
   * 선택한 주사위 다시 던지기
   * */
  @SubscribeMessage('putDice')
  async putDice(socket: Socket, data: PutDiceWsPlayDto) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    if (
      socket['userId'] ==
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] &&
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] > 0 &&
      data.diceResult &&
      data.diceIndex.length > 0 &&
      !this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice']
    ) {
      // console.log(data.diceIndex);
      const diceResult = await this.service.userPutDice(
        data.diceResult,
        data.diceIndex,
      );
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] -= 1;
      // console.log('result', diceResult);
      this.server.sockets.in(roomNumIdx.roomNumber.toString()).emit('putDice', {
        state: 1,
        message: `${socket['userId']} 이(가) 선택한 주사위를 다시 던짐`,
        diceResult: diceResult,
        scoreBoard: await this.service.refreshScoreBoard(
          socket,
          this.roomInfo,
          this.gameInfo,
          {
            diceResult: diceResult,
            userId: socket['userId'],
            gameInfoIdx: gameInfoIdx.gameInfoIdx,
            roomNumber: roomNumIdx.roomNumber,
          },
        ),
        diceCount:
          this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'],
      });
      console.log(
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'],
      );
    } else {
      if (
        socket['userId'] ==
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0]
      ) {
        if (
          this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] <= 0
        ) {
          socket.emit('putDice', {
            state: 0,
            message: '남은 주사위가 없음',
          });
        } else {
          socket.emit('putDice', {
            state: 0,
            message: '주사위가 선택되지 않음',
          });
        }
      } else {
        socket.emit('putDice', {
          state: 0,
          message: `${
            this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0]
          }의 턴`,
        });
      }
    }
  }

  /*
   * 사용자가 점수를 선택할 때
   * */
  @SubscribeMessage('saveScore')
  async endTurn(socket: Socket, data: SaveScoreWsPlayDto) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    // 다음사람 점수판 가져오기
    let scoreBoard, userPlayInfoIdx;
    for (
      let i = 0;
      i < this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.length;
      i++
    ) {
      if (
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[1] ==
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[i]['userId']
      ) {
        scoreBoard = this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[i];
      }
      if (
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[i]['userId'] ==
        socket['userId']
      ) {
        userPlayInfoIdx = i;
      }
    }

    if (
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] ==
        socket['userId'] &&
      !this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice']
    ) {
      if (
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
          gameInfoIdx.userPlayInfoIdx
        ][data.scoreType] === null // 이미 선택한 점수인지 아닌지 파악
      ) {
        const pickScore = await this.service.getPickScoreVal(
          socket,
          this.roomInfo,
          this.gameInfo,
          data,
        );
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
          gameInfoIdx.userPlayInfoIdx
        ][data.scoreType] = Number(pickScore); // user 점수 object에 해당 점수 저장
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.shift(); // 턴의 첫 번째 순서를 바꿈 (배열 첫 번째 값을 지운다)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.push(
          socket['userId'],
        ); // (배열 끝에 아이디를 추가함)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = true; // 주사위를 던질 수 있는 조건을 바꿈
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] = 2; // 주사위를 바꿀 수 있는 횟수를 변경
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('userScoreBoard', {
            scoreBoard: scoreBoard,
            picked: await this.service.getUserPick(scoreBoard),
          }); // 다음 턴 유저 점수판 전송
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
          gameInfoIdx.userPlayInfoIdx
        ]['userScore'] += Number(pickScore); // 유저가 선택한 점수를 더함
        await this.service.checkBonusScore(this.gameInfo, gameInfoIdx); // 보너스 점수 체크

        /*
         * 유저 턴 체크
         * */
        // await this.service.playInfoTurnCheck(this.gameInfo, gameInfoIdx);

        this.server.in(roomNumIdx.roomNumber.toString()).emit(
          'userScoreInfo',
          this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo, // 현재 진행중인 room의 유저들 아이디, 이름, 점수(확인필요) 를 전달함
        );

        if (await this.service.gameEndCheck(this.gameInfo, gameInfoIdx)) {
          const result = await this.service.gameEndMethod(
            this.gameInfo,
            gameInfoIdx,
            roomNumIdx,
            true,
          );

          if (result) {
            this.server.sockets
              .in(roomNumIdx.roomNumber.toString())
              .emit('gameEnd', result.reverse());
          }
        } else {
          this.server.in(roomNumIdx.roomNumber.toString()).emit('diceTurn', {
            message: 'diceTurn',
            diceTurn: this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0], // 현재 주사위 턴 유저 전달
            diceTurnName: await this.service.getDiceTurnName(
              this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0],
              this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo,
            ),
          });
        }


      } else {
        console.log('이미 입력된 점수');
        socket.emit('error', {
          message: '이미 입력된 점수입니다.',
        });
      }
    }
  }

  // 유저id로 roomNumber 찾기
  private async findUserRoom(userId) {
    let roomNumber = null;
    let roomInfoidx = null;
    let userInfoIdx = null;
    await this.roomInfo.forEach((info, index) => {
      // console.log('info',info.userInfo.length)
      for (let i = 0; i < info.userInfo.length; i++) {
        if (info.userInfo[i]['userId'] == userId) {
          roomNumber = info.roomNumber;
          roomInfoidx = index;
          userInfoIdx = i;
        }
      }
    });

    return {
      roomNumber: roomNumber,
      roomInfoIdx: roomInfoidx,
      userInfoIdx: userInfoIdx,
    };
  }

  // roomNumber로 gameInfo배열의 idx 찾기
  private async findGameInfoIdx(data) {
    let gameInfoIdx = null;
    let userPlayInfoIdx = null;
    for (let i = 0; i < this.gameInfo.length; i++) {
      console.log(this.gameInfo[i].roomNumber, ' =>', data.roomNumber);
      if (this.gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
        for (let j = 0; j < this.gameInfo[i].userPlayInfo.length; j++) {
          if (this.gameInfo[i].userPlayInfo[j]['userId'] == data.userId) {
            userPlayInfoIdx = j;
          }
        }
      }
    }
    return { gameInfoIdx: gameInfoIdx, userPlayInfoIdx: userPlayInfoIdx };
  }

  @SubscribeMessage('changeHost')
  async changeHost(socket: Socket) {
    socket['userRole'] = 'host';
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
      'userState'
    ] = 'ready';
    this.server.sockets
      .in(roomNumIdx.roomNumber.toString())
      .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
  }

  @SubscribeMessage('getUserScoreBoard')
  async getUserScoreBoard(socket: Socket, data) {
    const scoreData = await this.service.getUserScoreBoard(
      socket,
      this.roomInfo,
      this.gameInfo,
      data,
    );

    socket.emit('getUserScoreBoard', scoreData);
  }
  @Interval(10000)
  async deleteEmptyRoom() {
    const {
      sockets: {
        adapter: { sids, rooms },
      },
    } = this.server;

    // console.log(sids);
    const publicRooms = [];
    rooms.forEach((_, key) => {
      if (sids.get(key) === undefined) {
        publicRooms.push(key);
      }
    });

    const roomList = await this.db.getRoomList();

    roomList.forEach((data) => {
      let bool = false;
      publicRooms.forEach((rooms) => {
        if (data.room_id === +rooms) {
          bool = true;
        }
      });
      if (bool === false) {
        try {
          this.db.deleteRoom(data.room_id);
        } catch (e) {}
      }
    });
  }
}
