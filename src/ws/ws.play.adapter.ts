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
    // > 목록 페이지로 강제로 내보냄
    // > 데이터베이스에 있는 방 목록 삭제
    // > entity에 있는 배열 삭제
    //let userRoomNumber = 0;
    // host가 방을 나가면 전부 방을 나가게 함
    if (socket['userRole'] === 'host') {
      // let index = 0;
      // let roomNumber = 0;
      // await this.roomInfo.forEach((info) => {
      //   for (let i = 0; i < info.userInfo.length; i++) {
      //     if (info.userInfo[i]['userId'] == socket['userId']) {
      //       socket.to(info.roomNumber.toString()).emit('disconnectHost');
      //       this.roomInfo.splice(index, 1);
      //       roomNumber = info.roomNumber;
      //     }
      //   }
      //   index++;
      // });

      /*
       * 유저가 참여하고 있는 방 번호와 roomInfo배열의 idx, roomInfo배열 안에 있는 userInfoIdx를 리턴함
       * findUserRoomNum(userId) return {roomNumber, roomInfoIdx, userInfoIdx}
       */
      const roomNumIdx = await this.findUserRoom(socket['userId']);
      const gameInfoIdx = await this.findGameInfoIdx({
        roomNumber: roomNumIdx.roomNumber,
        userId: socket['userId'],
      });
      try {
        /*
         * 유저의 데이터가 존재하는 roomInfo, gameInfo배열의 데이터를 삭제함
         * */
        this.roomInfo.splice(roomNumIdx.roomInfoIdx, 1);
        this.gameInfo.splice(gameInfoIdx.gameInfoIdx, 1);

        /*
         * 해당 방에 참여하고 있는 유저들을 다 내보냄
         * */
        socket.to(roomNumIdx.roomNumber.toString()).emit('disconnectHost');
      } catch (e) {
        console.log(`${socket['userId']} 방이 존재하지 않음`);
      }

      /*
       * 데이터베이스에 있는 해당 roomTable 데이터를 삭제한다.
       * */
      await this.db.deleteRoom(roomNumIdx.roomNumber);

      /*
       * 방 목록 새로고침
       * */
      this.server.sockets.emit('refreshRoom', await this.db.getRoomList());
    } else if (socket['userRole'] === 'user') {
      // 유저가 방을 나갔을 때 roomInfo에 있는 유저 정보를 삭제
      /*
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
      */

      /*
      let gameInfoIdx = 0;
      for (let i = 0; i < this.gameInfo.length; i++) {
        if (this.gameInfo[i].roomNumber == userRoomNumber) {
          gameInfoIdx = i;
        }
      }*/

      /*
       * 유저가 참여하고 있는 방 번호와 roomInfo배열의 idx, roomInfo배열 안에 있는 userInfoIdx를 리턴함
       * findUserRoomNum(userId) return {roomNumber, roomInfoIdx, userInfoIdx}
       */
      const roomNumIdx = await this.findUserRoom(socket['userId']);
      const gameInfoIdx = await this.findGameInfoIdx({
        roomNumber: roomNumIdx.roomNumber,
        userId: socket['userId'],
      });

      try {
        this.roomInfo[roomNumIdx.roomInfoIdx].userList.splice(
          roomNumIdx.userInfoIdx,
          1,
        );
        this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.splice(
          roomNumIdx.userInfoIdx,
          1,
        );
      } catch (e) {
        console.log('room 삭제됨');
      }
      // console.log(this.roomInfo[roomNumIdx.roomInfoIdx].userList);

      /*
      try {
        for (
          let i = 0;
          i < this.gameInfo[gameInfoIdx].userPlayInfo.length;
          i++
        ) {
          if (
            this.gameInfo[gameInfoIdx].userPlayInfo[i]['userId'] ==
            socket['userId']
          ) {
            this.gameInfo[gameInfoIdx].userPlayInfo.splice(i, 1);
            this.gameInfo[gameInfoIdx].userYahtScore.splice(i, 1);
          }
        }
      } catch (e) {
        console.log('유저 게임 시작 전 퇴장');
      }*/

      try {
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
      } catch (e) {
        console.log('유저 게임 시작 전 퇴장');
      }

      // console.log(userRoomNumber);
      try {
        await this.db.userQuitRoom(Number(roomNumIdx.roomNumber));
        //const roomInfoIdx = this.getMyRoomIdx(roomNumIdx.roomNumber);
        //console.log(roomInfoIdx, roomNumIdx.roomInfoIdx);
        this.server.emit('refreshRoom', await this.db.getRoomList());
        //console.log(roomInfoIdx);

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
  }

  private roomInfo: GameSetWsEntity[] = [];
  private gameInfo: GamePlayWsEntity[] = [];
  constructor(private db: PrismaService) {}

  // 방 생성
  @SubscribeMessage('hostCreateRoom')
  async hostCreateRoom(socket: Socket, data) {
    /*
     * 유저의 소켓에 userId, userRole, userName을 저장함
     * */
    socket['userId'] = data.userId;
    socket['userRole'] = 'host';
    socket['userName'] = data.userName;

    /*
     * 방번호에 해당하는 room에 join함
     * */
    socket.join(data.roomNumber);

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
  async joinRoom(socket: Socket, data) {
    socket.join(data.roomNumber);
    await this.savePlayInfo(socket, data);
  }

  // 유저 정보를 방목록 별로 저장
  //@SubscribeMessage('setPlayInfo')
  async savePlayInfo(socket: Socket, data) {
    const roomInfo = await this.db.findRoom(Number(data.roomNumber));

    // console.log(this.server.sockets.adapter.rooms.get(data.roomNumber).size);

    /*
     * 방 입장 제한 인원 수 초과 시 제한
     * */
    if (
      this.server.sockets.adapter.rooms.get(data.roomNumber).size >
      roomInfo.room_max_user
    ) {
      socket.emit('joinError');
      return false;
    }

    /*
     * db에 입장 인원 +1
     * */
    await this.db.userJoinRoom(Number(data.roomNumber));

    /*
     * 방 목록 새로고침
     * */
    this.server.emit('refreshRoom', await this.db.getRoomList());

    /*
     * 유저의 정보를 socket에 저장함
     * */
    socket['userId'] = data.userId;
    socket['userRole'] = 'user';
    socket['userName'] = data.userName;

    let index;
    for (let i = 0; i < this.roomInfo.length; i++) {
      if (this.roomInfo[i].roomNumber == data.roomNumber) {
        index = i;
      }
    }

    /*
     * roomInfo 배열에 유저 정보 저장
     * */
    this.roomInfo[index].userInfo.push({
      socId: [...socket.rooms][0],
      userId: data.userId,
      userName: data.userName,
      userState: 'none',
      userRole: 'user',
    });
    this.roomInfo[index].userList.push(data.userId);

    /*
     * 참여한 room에 있는 유저들에게 새로운 유저 입장 알림
     * */
    socket.to(data.roomNumber).emit('userJoinRoom', {
      joinUserName: data.userName,
      message: `${data.userName} 님이 입장하셨습니다.`,
    });

    const roomNumIdx = await this.findUserRoom(socket['userId']);
    // const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);

    /*
     * 방에 참여중인 유저 새로고침
     * */
    this.server.sockets
      .in(data.roomNumber)
      .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
  }

  /*
   * user 준비 버튼 클릭
   * */
  // @SubscribeMessage('setUserReady')
  // async setUserReady(socket: Socket) {
  //   //const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);
  //   const roomNumIdx = await this.findUserRoom(socket['userId']);
  //
  //   /*
  //    * 유저 준비 상태에 따른 준비, 준비 취소
  //    * */
  //   this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
  //     'userState'
  //   ] == 'none'
  //     ? (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
  //         'userState'
  //       ] = 'ready')
  //     : (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
  //         'userState'
  //       ] = 'none');
  //
  //   /*
  //    * room에 참여중인 user 업데이트
  //    * */
  //   this.server.sockets
  //     .in(roomNumIdx.roomNumber.toString())
  //     .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
  //
  //   /*
  //   for (let i = 0; i < this.roomInfo[roomInfoIdx].userInfo.length; i++) {
  //     if (
  //       this.roomInfo[roomInfoIdx].userInfo[i]['userId'] == socket['userId']
  //     ) {
  //       this.roomInfo[roomInfoIdx].userInfo[i]['userState'] == 'none'
  //         ? (this.roomInfo[roomInfoIdx].userInfo[i]['userState'] = 'ready')
  //         : (this.roomInfo[roomInfoIdx].userInfo[i]['userState'] = 'none');
  //       this.server.sockets
  //         .in(data.roomNumber)
  //         .emit('refreshUserList', this.roomInfo[roomInfoIdx]);
  //     }
  //   }*/
  // }

  /*
   * host 게임 시작 버튼 클릭 시
   * */
  @SubscribeMessage('gameReadyBtn')
  async hostGameStart(socket: Socket) {
    //const roomInfoIdx = this.getMyRoomIdx(data.roomNumber);
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    switch (socket['userRole']) {
      case 'host':
        if (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.length >= 2) {
          const noneList = [];
          let bool = true;
          this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.forEach((list) => {
            if (list['userState'] != 'ready') {
              noneList.push(list['userName']);
              bool = false;
            }
          });

          /*let gameInfoIdx = 0;
          for (let i = 0; i < this.gameInfo.length; i++) {
            if (this.gameInfo[i].roomNumber == data.roomNumber) {
              gameInfoIdx = i;
            }
          }*/

          bool
            ? (this.server.sockets
                .in(roomNumIdx.roomNumber.toString())
                .emit('gameStart', { message: '게임 시작', state: 1 }),
              await this.db.startGame(Number(roomNumIdx.roomNumber)),
              this.server.sockets.emit(
                'refreshRoom',
                await this.adapter.getRoomList(),
              ),
              await this.setGamePlayInfo({
                roomInfoIdx: roomNumIdx.roomInfoIdx,
                roomNumber: roomNumIdx.roomNumber,
              }),
              this.server.sockets
                .in(roomNumIdx.roomNumber.toString())
                .emit(
                  'userScoreBoard',
                  this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[0],
                ))
            : this.server.sockets
                .in(roomNumIdx.roomNumber.toString())
                .emit('gameStart', {
                  message: '게임 시작 실패',
                  state: 0,
                  noneList: noneList,
                });
        }
        break;
      case 'user':
        /*
         * 유저 준비 상태에 따른 준비, 준비 취소
         * */
        this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
          'userState'
        ] == 'none'
          ? (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[
              roomNumIdx.userInfoIdx
            ]['userState'] = 'ready')
          : (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[
              roomNumIdx.userInfoIdx
            ]['userState'] = 'none');

        /*
         * room에 참여중인 user 업데이트
         * */
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('refreshUserList', this.roomInfo[roomNumIdx.roomInfoIdx]);
        break;
      default:
        return false;
    }

    // if (
    //   socket['userRole'] == 'host' &&
    //   this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.length >= 2
    // ) {
    //   const noneList = [];
    //   let bool = true;
    //   this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.forEach((list) => {
    //     if (list['userState'] != 'ready') {
    //       noneList.push(list['userName']);
    //       bool = false;
    //     }
    //   });
    //
    //   /*let gameInfoIdx = 0;
    //   for (let i = 0; i < this.gameInfo.length; i++) {
    //     if (this.gameInfo[i].roomNumber == data.roomNumber) {
    //       gameInfoIdx = i;
    //     }
    //   }*/
    //
    //   bool
    //     ? (this.server.sockets
    //         .in(roomNumIdx.roomNumber.toString())
    //         .emit('gameStart', { message: '게임 시작', state: 1 }),
    //       await this.db.startGame(Number(roomNumIdx.roomNumber)),
    //       this.server.sockets.emit(
    //         'refreshRoom',
    //         await this.adapter.getRoomList(),
    //       ),
    //       await this.setGamePlayInfo({
    //         roomInfoIdx: roomNumIdx.roomInfoIdx,
    //         roomNumber: roomNumIdx.roomNumber,
    //       }),
    //       this.server.sockets
    //         .in(roomNumIdx.roomNumber.toString())
    //         .emit(
    //           'userScoreBoard',
    //           this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[0],
    //         ))
    //     : this.server.sockets
    //         .in(roomNumIdx.roomNumber.toString())
    //         .emit('gameStart', {
    //           message: '게임 시작 실패',
    //           state: 0,
    //           noneList: noneList,
    //         });
    // }
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
    // this.roomInfo.forEach((list) => {
    //   console.log(list.roomNumber);
    //   console.log(list.userInfo);
    //   console.log(list.userList);
    // });

    //console.log(this.roomInfo[0].userInfo);
  }

  // getMyRoomIdx(roomNumber) {
  //   let roomInfoIdx = 0;
  //   for (let i = 0; i < this.roomInfo.length; i++) {
  //     if (this.roomInfo[i].roomNumber == roomNumber) {
  //       roomInfoIdx = i;
  //     }
  //   }
  //   return roomInfoIdx;
  // }

  async setGamePlayInfo(data) {
    const playUserInfo = this.roomInfo[data.roomInfoIdx];

    //console.log(playUserInfo);
    // const playUserInfo = this.roomInfo[data.roomInfo];
    // const userInfo = playUserInfo.userInfo;
    const userPlayInfoArray = [];
    const userPlayScoreArray = [];
    // let gameBool = true;
    //
    // await this.gameInfo.forEach((list) => {
    //   if (list.roomNumber == data.roomNumber) {
    //     gameBool = false;
    //   }
    // });
    //
    // if (!gameBool) return;

    /*
     * 다중 생성 방지
     * */
    await this.gameInfo.forEach((list) => {
      if (list.roomNumber == data.roomNumber) {
        return false;
      }
    });

    console.log('진행');

    /*
     * 유저별 점수 Array 생성
     * */
    for (let i = 0; i < playUserInfo.userList.length; i++) {
      userPlayInfoArray.push({
        userId: playUserInfo.userInfo[i]['userId'],
        userName: playUserInfo.userInfo[i]['userName'],
        userScore: 0,
      });

      userPlayScoreArray.push({
        userId: playUserInfo.userInfo[i]['userId'],
        ones: null,
        twos: null,
        threes: null,
        fours: null,
        fives: null,
        sixes: null,
        bonus: null,
        triple: null,
        four_card: null,
        full_house: null,
        small_straight: null,
        large_straight: null,
        chance: null,
        yahtzee: null,
      });
    }

    /*
     * gameInfo 배열에 게임 시작 정보 저장
     * */
    this.gameInfo.push({
      roomNumber: this.roomInfo[data.roomInfoIdx].roomNumber,
      userPlayInfo: userPlayInfoArray,
      userDiceTurn: this.roomInfo[data.roomInfoIdx].userList,
      userYahtScore: userPlayScoreArray,
      gameRound: 0,
      userDiceSet: {
        throwDice: true,
        diceCount: 2,
      },
    });

    /*
     * 주사위 턴 알림
     * */
    this.server.in(data.roomNumber).emit('diceTurn', {
      message: 'diceTurn',
      diceTurn: this.roomInfo[data.roomInfoIdx].userList[0],
    });
  }

  /*
   * 사용자가 주사위를 던졌을 때
   * */
  @SubscribeMessage('throwDice')
  async throwDice(socket: Socket) {
    // data에 있어야 할 것 // 없앰
    // {
    //   roomNumber = 방번호
    // }

    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    // let gameInfoIdx = 0;
    // for (let i = 0; i < this.gameInfo.length; i++) {
    //   if (this.gameInfo[i].roomNumber == data.roomNumber) {
    //     gameInfoIdx = i;
    //   }
    // }

    if (
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] == socket['userId']
    ) {
      if (!this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice']) {
        socket.emit('throwDice', {
          state: 0,
          message: `주사위는 한번 만 던질 수 있음`,
        });
      } else {
        const diceResult = await this.userThrowDice();
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('throwDice', {
            state: 1,
            message: `${socket['userId']} 이(가) 주사위를 던짐`,
            diceResult: diceResult,
            scoreBoard: await this.refreshScoreBoard({
              diceResult: diceResult,
              userId: socket['userId'],
              gameInfoIdx: gameInfoIdx.gameInfoIdx,
              roomNumber: roomNumIdx.roomNumber,
            }),
          });
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = false;
      }

      // 주사위 턴 변경
      // this.gameInfo[gameInfoIdx].userDiceTurn.shift();
      // this.gameInfo[gameInfoIdx].userDiceTurn.push(socket['userId']);
    } else {
      socket.emit('throwDice', {
        state: 0,
        message: `${
          this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0]
        }의 턴`,
      });
    }
  }

  /*
   * 선택한 주사위 다시 던지기
   * */
  @SubscribeMessage('putDice')
  async putDice(socket: Socket, data) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    /*let gameInfoIdx;
    for (let i = 0; i < this.gameInfo.length; i++) {
      if (this.gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
      }
    }*/

    if (
      socket['userId'] ==
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] &&
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] > 0 &&
      data.diceResult &&
      data.diceIndex.length > 0 &&
      !this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice']
    ) {
      // console.log(data.diceIndex);
      const diceResult = await this.userPutDice(
        data.diceResult,
        data.diceIndex,
      );
      this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] -= 1;
      // console.log('result', diceResult);
      this.server.sockets.in(roomNumIdx.roomNumber.toString()).emit('putDice', {
        state: 1,
        message: `${socket['userId']} 이(가) 선택한 주사위를 다시 던짐`,
        diceResult: diceResult,
        scoreBoard: await this.refreshScoreBoard({
          diceResult: diceResult,
          userId: socket['userId'],
          gameInfoIdx: gameInfoIdx.gameInfoIdx,
          roomNumber: roomNumIdx.roomNumber,
        }),
      });
      //await this.refreshScoreBoard({ diceResult: diceResult });
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
  async endTurn(socket: Socket, data) {
    const roomNumIdx = await this.findUserRoom(socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx({
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    // let gameInfoIdx = 0;
    // for (let i = 0; i < this.gameInfo.length; i++) {
    //   if (this.gameInfo[i].roomNumber == data.roomNumber) {
    //     gameInfoIdx = i;
    //   }
    // }

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
    // console.log(data);
    // console.log(gameInfoIdx);
    // console.log(this.gameInfo[gameInfoIdx].userYahtScore.length);

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
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
          gameInfoIdx.userPlayInfoIdx
        ][data.scoreType] = Number(data.scoreValue); // user 점수 object에 해당 점수 저장
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.shift(); // 턴의 첫 번째 순서를 바꿈 (배열 첫 번째 값을 지운다)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.push(
          socket['userId'],
        ); // (배열 끝에 아이디를 추가함)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = true; // 주사위를 던질 수 있는 조건을 바꿈
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] = 2; // 주사위를 바꿀 수 있는 횟수를 변경
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('userScoreBoard', scoreBoard); // 다음 턴 유저 점수판 전송
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
          gameInfoIdx.userPlayInfoIdx
        ]['userScore'] += Number(data.scoreValue); // 유저가 선택한 점수를 더함
        this.gameInfo[gameInfoIdx.gameInfoIdx].gameRound += 1; // 라운드 증가
        this.server.in(roomNumIdx.roomNumber.toString()).emit(
          'userScoreInfo',
          this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo, // 현재 진행중인 room의 유저들 아이디, 이름, 점수(확인필요) 를 전달함
        );
        this.server.in(roomNumIdx.roomNumber.toString()).emit('diceTurn', {
          message: 'diceTurn',
          diceTurn: this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0], // 현재 주사위 턴 유저 전달
        });
        if (
          this.gameInfo[gameInfoIdx.gameInfoIdx].gameRound ==
          this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.length * 3 // 게임 라운드
        ) {
          console.log('게임 끝');
          const result = this.gameInfo[
            gameInfoIdx.gameInfoIdx
          ].userPlayInfo.sort((a, b) => {
            return a['userScore'] - b['userScore'];
          });
          this.server.sockets
            .in(roomNumIdx.roomNumber.toString())
            .emit('gameEnd', result.reverse()); // 점수별 순위 내림차순 전달
        }
      } else {
        console.log('이미 입력된 점수');
        socket.emit('error', {
          message: '이미 입력된 점수입니다.',
        });
      }
    }
    /*
    for (let i = 0; i < this.gameInfo[gameInfoIdx].userYahtScore.length; i++) {
      if (
        this.gameInfo[gameInfoIdx].userYahtScore[i]['userId'] == // 이건 해당 인덱스를 파악하기 위한 조건
          socket['userId'] &&
        this.gameInfo[gameInfoIdx].userDiceTurn[0] == socket['userId'] && // 턴이 맞는지 확인하는 것
        !this.gameInfo[gameInfoIdx].userDiceSet['throwDice'] // 주사위를 한번이라도 던지고 바꾸는지 확인하는 것
      ) {
        if (
          this.gameInfo[gameInfoIdx].userYahtScore[i][data.scoreType] === null
        ) {
          this.gameInfo[gameInfoIdx].userYahtScore[i][data.scoreType] = Number(
            data.scoreValue,
          );
          this.gameInfo[gameInfoIdx].userDiceTurn.shift();
          this.gameInfo[gameInfoIdx].userDiceTurn.push(socket['userId']);
          this.gameInfo[gameInfoIdx].userDiceSet['throwDice'] = true;
          console.log(this.gameInfo[gameInfoIdx].userYahtScore[i]);
          this.gameInfo[gameInfoIdx].userDiceSet['diceCount'] = 2;
          this.server.sockets
            .in(data.roomNumber)
            .emit('userScoreBoard', scoreBoard);
          this.gameInfo[gameInfoIdx].userPlayInfo[userPlayInfoIdx][
            'userScore'
          ] += Number(data.scoreValue);
          this.gameInfo[gameInfoIdx].gameRound += 1;
          this.server.sockets
            .in(data.roomNumber)
            .emit('userScoreInfo', this.gameInfo[gameInfoIdx].userPlayInfo);
          this.server.in(data.roomNumber).emit('diceTurn', {
            message: 'diceTurn',
            diceTurn: this.gameInfo[gameInfoIdx].userDiceTurn[0],
          }); ////////
          if (
            this.gameInfo[gameInfoIdx].gameRound ==
            this.gameInfo[gameInfoIdx].userDiceTurn.length * 3 // 게임 라운드
          ) {
            console.log('게임 끝');
            const result = this.gameInfo[gameInfoIdx].userPlayInfo.sort(
              (a, b) => {
                return a['userScore'] - b['userScore'];
              },
            );
            this.server.sockets
              .in(data.roomNumber)
              .emit('gameEnd', result.reverse());
          }
        } else {
          console.log('이미 입력된 점수');
          socket.emit('error', {
            message: '이미 입력된 점수입니다.',
          });
        }
      }
    }

     */

    /*
    for (let i = 0; i < this.gameInfo[gameInfoIdx].userYahtScore.length; i++) {
      if (
        this.gameInfo[gameInfoIdx].userYahtScore[i]['userId'] ==
          socket['userId'] &&
        !this.gameInfo[gameInfoIdx].userYahtScore[i][
          data.scoreType.toString()
        ] &&
        !this.gameInfo[gameInfoIdx].userDiceSet['throwDice'] &&
        this.gameInfo[gameInfoIdx].userDiceTurn[0] == socket['userId']
      ) {
        this.gameInfo[gameInfoIdx].userYahtScore[i][data.scoreType] = Number(
          data.scoreValue,
        );
        this.gameInfo[gameInfoIdx].userDiceTurn.shift();
        this.gameInfo[gameInfoIdx].userDiceTurn.push(socket['userId']);
        this.gameInfo[gameInfoIdx].userDiceSet['throwDice'] = true;

        this.server.sockets
          .in(data.roomNumber)
          .emit('userScoreBoard', scoreBoard);
      }
    }
     */
  }

  async userThrowDice() {
    const diceArr = [];
    for (let i = 0; i < 5; i++) {
      diceArr.push(Math.floor(Math.random() * 6) + 1);
    }

    return {
      firstDice: diceArr[0],
      secDice: diceArr[1],
      trdDice: diceArr[2],
      fothDice: diceArr[3],
      fithDice: diceArr[4],
    };
  }

  async userPutDice(diceResult, data) {
    // data는 변경할 dice의 인덱스를 가져옴
    // ex) diceResult = [4, 5, 1, 1, 3]
    // ex) data = [0, 2, 3]
    const result = diceResult;
    // console.log(result);

    for (let i = 0; i < data.length; i++) {
      const dice = Math.floor(Math.random() * 6) + 1;
      switch (data[i]) {
        case 0:
          result.firstDice = dice;
          break;
        case 1:
          result.secDice = dice;
          break;
        case 2:
          result.trdDice = dice;
          break;
        case 3:
          result.fothDice = dice;
          break;
        case 4:
          result.fithDice = dice;
          break;
      }
    }
    /*
    for (let i = 0; i < data.length; i++) {
      result[data[i]] = Math.floor(Math.random() * 6) + 1;
    }
    console.log(typeof result);*/
    console.log(typeof result);
    return result;
  }

  // 현재 주사위 점수 가져오기
  async refreshScoreBoard(data) {
    // console.log(data);
    // const dice = data.diceResult;\

    // data {}
    // diceResult: diceResult,
    // userId: socket['userId'],
    // gameInfoIdx: gameInfoIdx,
    // roomNumber: data.roomNumber,

    const dice = [
      data.diceResult.firstDice,
      data.diceResult.secDice,
      data.diceResult.trdDice,
      data.diceResult.fothDice,
      data.diceResult.fithDice,
    ];

    //console.log(dice); //type Array
    //console.log(typeof dice[0]); // type Number
    let bonus = 0,
      triple = 0,
      four_card = 0,
      full_house = 0,
      small_straight = 0,
      large_straight = 0,
      chance = 0,
      yahtzee = 0,
      yahtzee_bonus;

    dice.forEach((data) => {
      // 트리플
      if (dice.filter((list) => data === list).length >= 3) {
        triple = dice.reduce((sum, currValue) => {
          return sum + currValue;
        }, 0);
      }
      // 포 카드
      if (dice.filter((list) => data === list).length >= 4) {
        four_card = dice.reduce((sum, currValue) => {
          return sum + currValue;
        }, 0);
      }
      // 풀 하우스
      if (dice.filter((list) => data === list).length >= 3) {
        const temp = dice.filter((elem) => elem !== data);
        for (let i = 0; i < temp.length; i++) {
          if (temp.filter((tempList) => temp[i] === tempList).length >= 2) {
            full_house = 25;
          }
        }
      }

      // 찬스
      chance += data;

      // 야찌
      if (dice.filter((list) => data === list).length >= 5) {
        yahtzee = 50;
      }
    });

    // 스몰 스트레이트
    let diceSort = dice.sort();
    const set = new Set(diceSort);
    diceSort = [...set];
    //console.log('sort', diceSort);
    const smallStVal = [4, 5, 6];
    if (diceSort.length >= 5) {
      const smallSt2 = [[], []];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
          smallSt2[i].push(diceSort[i + j]);
        }
        smallSt2[i][0] += 3;
        smallSt2[i][1] += 2;
        smallSt2[i][2] += 1;
      }
      //console.log(smallSt2);
      for (let i = 0; i < smallSt2.length; i++) {
        for (let j = 0; j < smallStVal.length; j++) {
          if (smallSt2[i].filter((list) => smallStVal[j] === list).length >= 4)
            small_straight = 35;
        }
      }
      const largeSt = diceSort;
      largeSt[0] += 4;
      largeSt[1] += 3;
      largeSt[2] += 2;
      largeSt[3] += 1;

      for (let i = 0; i < 2; i++) {
        if (largeSt.filter((list) => smallStVal[i + 1] === list).length >= 5)
          large_straight = 40;
      }
    } else if (diceSort.length >= 4) {
      const smallSt1 = [];
      for (let i = 0; i < diceSort.length; i++) {
        smallSt1.push(diceSort[i]);
      }
      smallSt1[0] += 3;
      smallSt1[1] += 2;
      smallSt1[2] += 1;
      for (let i = 0; i < smallStVal.length; i++) {
        if (smallSt1.filter((list) => smallStVal[i] === list).length >= 4) {
          small_straight = 35;
        }
      }
      //console.log(smallSt1);
    }

    // 라지 스트레이트

    //----------------------------------------
    // 유저 현재 점수 가져오기
    let scoreBoard;
    const picked = [];

    for (
      let i = 0;
      i < this.gameInfo[data.gameInfoIdx].userYahtScore.length;
      i++
    ) {
      if (
        this.gameInfo[data.gameInfoIdx].userYahtScore[i]['userId'] ==
        data.userId
      ) {
        scoreBoard = this.gameInfo[data.gameInfoIdx].userYahtScore[i];
      }
    }
    console.log('--------------------------------------');
    // 보너스

    console.log(scoreBoard);

    const scoreObject = {
      ones: dice.filter((data) => 1 === data).length * 1,
      twos: dice.filter((data) => 2 === data).length * 2,
      threes: dice.filter((data) => 3 === data).length * 3,
      fours: dice.filter((data) => 4 === data).length * 4,
      fives: dice.filter((data) => 5 === data).length * 5,
      sixes: dice.filter((data) => 6 === data).length * 6,
      //bonus: bonus,
      triple: triple,
      four_card: four_card,
      full_house: full_house,
      small_straight: small_straight,
      large_straight: large_straight,
      chance: chance,
      yahtzee: yahtzee,
    };
    // 총 14개
    // console.log(scoreObject);

    scoreObject.ones =
      scoreBoard.ones === null ? scoreObject.ones : scoreBoard.ones;
    picked.push(scoreBoard.ones === null ? null : 'ones');

    scoreObject.twos =
      scoreBoard.twos === null ? scoreObject.twos : scoreBoard.twos;
    picked.push(scoreBoard.twos === null ? null : 'twos');

    scoreObject.threes =
      scoreBoard.threes === null ? scoreObject.threes : scoreBoard.threes;
    picked.push(scoreBoard.threes === null ? null : 'threes');

    scoreObject.fours =
      scoreBoard.fours === null ? scoreObject.fours : scoreBoard.fours;
    picked.push(scoreBoard.fours === null ? null : 'fours');

    scoreObject.fives =
      scoreBoard.fives === null ? scoreObject.fives : scoreBoard.fives;
    picked.push(scoreBoard.fives === null ? null : 'fives');

    scoreObject.sixes =
      scoreBoard.sixes === null ? scoreObject.sixes : scoreBoard.sixes;
    picked.push(scoreBoard.sixes === null ? null : 'sixes');

    scoreObject.triple =
      scoreBoard.triple === null ? scoreObject.triple : scoreBoard.triple;
    picked.push(scoreBoard.triple === null ? null : 'triple');

    scoreObject.four_card =
      scoreBoard.four_card === null
        ? scoreObject.four_card
        : scoreBoard.four_card;
    picked.push(scoreBoard.four_card === null ? null : 'four_card');

    scoreObject.full_house =
      scoreBoard.full_house === null
        ? scoreObject.full_house
        : scoreBoard.full_house;
    picked.push(scoreBoard.full_house === null ? null : 'full_house');

    scoreObject.small_straight =
      scoreBoard.small_straight === null
        ? scoreObject.small_straight
        : scoreBoard.small_straight;
    picked.push(scoreBoard.small_straight === null ? null : 'small_straight');

    scoreObject.large_straight =
      scoreBoard.large_straight === null
        ? scoreObject.large_straight
        : scoreBoard.large_straight;
    picked.push(scoreBoard.large_straight === null ? null : 'large_straight');

    scoreObject.chance =
      scoreBoard.chance === null ? scoreObject.chance : scoreBoard.chance;
    picked.push(scoreBoard.chance === null ? null : 'chance');

    scoreObject.yahtzee =
      scoreBoard.yahtzee === null ? scoreObject.yahtzee : scoreBoard.yahtzee;
    picked.push(scoreBoard.yahtzee === null ? null : 'yahtzee');

    const pick = picked.filter((data) => data !== null);
    console.log(pick);

    bonus =
      scoreBoard.ones +
        scoreBoard.twos +
        scoreBoard.threes +
        scoreBoard.fours +
        scoreBoard.fives +
        scoreBoard.sixes >=
      63
        ? 35
        : 0;

    scoreObject['bonus'] = bonus;
    return { scoreValue: scoreObject, picked: pick };

    //bonus = ones + twos + threes + fours + fives + sixes >= 63 ? 35 : 0;
  }

  //--

  // 유저id로 roomNumber 찾기
  private async findUserRoom(userId) {
    let roomNumber = 0;
    let roomInfoidx = 0;
    let userInfoIdx = 0;
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
    let gameInfoIdx = 0;
    let userPlayInfoIdx = 0;
    for (let i = 0; i < this.gameInfo.length; i++) {
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
}
