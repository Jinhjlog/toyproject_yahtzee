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
import { JwtService } from '@nestjs/jwt';
import { CreateRoomWsPlayDto } from './dto/create-room.ws.play.dto';
import { PutDiceWsPlayDto } from './dto/put-dice.ws.play.dto';
import { SaveScoreWsPlayDto } from './dto/save-score.ws.play.dto';

@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsPlayAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  @Inject()
  private adapter: WsAdapter;

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
    // host가 방을 나가면 전부 방을 나가게 함
    if (socket['userRole'] === 'host') {
      /*
       * 유저가 참여하고 있는 방 번호와 roomInfo배열의 idx, roomInfo배열 안에 있는 userInfoIdx를 리턴함
       * findUserRoomNum(userId) return {roomNumber, roomInfoIdx, userInfoIdx}
       */
      // const roomNumIdx = await this.findUserRoom(socket['userId']);
      // const gameInfoIdx = await this.findGameInfoIdx({
      //   roomNumber: roomNumIdx.roomNumber,
      //   userId: socket['userId'],
      // });

      // 유저가 존재하는 roomInfo gameInfo 배열의 데이터를 삭제한다
      // 게임 시작 전에는 gameInfo의 배열이 존재하지 않음
      // 먼저 roomInfo의 데이터를 삭제함

      /*
       * roomInfo의 userInfo와 userList의 유저 해당 정보 삭제
       * */
      console.log("******************************************************** ", this.roomInfo[roomNumIdx.roomInfoIdx])
      this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.splice(
        roomNumIdx.userInfoIdx,
        1,
      );
      this.roomInfo[roomNumIdx.roomInfoIdx].userList.splice(
        roomNumIdx.userInfoIdx,
        1,
      );

      /*
       * gameInfo의 userPlayInfo를 삭제한다.
       * */
      try {
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn = this.gameInfo[
          gameInfoIdx.gameInfoIdx
        ].userDiceTurn.filter((data) => data !== socket['userId']);
      } catch (e) {}

      /*
       * 게임 인원이 1명인지 체크
       * */
      const tempBool = await this.gamePlayUserCheck(gameInfoIdx);

      /*
       * 게임 인원이 1명이라면 남은 인원이 게임을 승리하고 종료
       * */
      await this.gameEndMethod(gameInfoIdx, roomNumIdx, tempBool);

      /*
       * 방장을 넘김
       * */
      try {
        this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['userRole'] = 'host';
        await this.db.changeHost({
          roomId: roomNumIdx.roomNumber,
          userId: this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['userId'],
        });
        this.server.sockets
          .in(this.roomInfo[roomNumIdx.roomInfoIdx].userInfo[0]['socId'])
          .emit('changeHost');
      } catch (e) {
        console.log('db에러');
      }

      /*
       * 주사위 턴 세팅
       * */
      try {
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = true;
        this.server.in(roomNumIdx.roomNumber.toString()).emit('diceTurn', {
          message: 'diceTurn',
          diceTurn:
            this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
              gameInfoIdx.userPlayInfoIdx
            ]['userDiceTurn'][0],
        });
      } catch (e) {}

      //=======================================

      // try {
      //   /*
      //    * 유저의 데이터가 존재하는 roomInfo, gameInfo배열의 데이터를 삭제함
      //    * */
      //   this.roomInfo.splice(roomNumIdx.roomInfoIdx, 1);
      //   this.gameInfo.splice(gameInfoIdx.gameInfoIdx, 1);
      //
      //   /*
      //    * 해당 방에 참여하고 있는 유저들을 다 내보냄
      //    * */
      //   socket.to(roomNumIdx.roomNumber.toString()).emit('disconnectHost');
      // } catch (e) {
      //   console.log(`${socket['userId']} 방이 존재하지 않음`);
      // }
      //
      // /*
      //  * 데이터베이스에 있는 해당 roomTable 데이터를 삭제한다.
      //  * */
      // await this.db.deleteRoom(roomNumIdx.roomNumber);

      /*
       * 방 목록 새로고침
       * */
      // this.server.sockets.emit('refreshRoom', await this.db.getRoomList());
    } else if (socket['userRole'] === 'user') {
      // 유저가 방을 나갔을 때 roomInfo에 있는 유저 정보를 삭제

      /*
       * 유저가 참여하고 있는 방 번호와 roomInfo배열의 idx, roomInfo배열 안에 있는 userInfoIdx를 리턴함
       * findUserRoomNum(userId) return {roomNumber, roomInfoIdx, userInfoIdx}
       */
      // const roomNumIdx = await this.findUserRoom(socket['userId']);
      // const gameInfoIdx = await this.findGameInfoIdx({
      //   roomNumber: roomNumIdx.roomNumber,
      //   userId: socket['userId'],
      // });

      // await this.gamePlayUserCheck({
      //   gameInfoIdx: gameInfoIdx.gameInfoIdx,
      // });

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

      try {
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.splice(
          gameInfoIdx.userPlayInfoIdx,
          1,
        );
        // this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn = this.gameInfo[
        //   gameInfoIdx.gameInfoIdx
        //   ].userDiceTurn.filter((data) => data !== socket['userId']);
      } catch (e) {
        console.log('유저 게임 시작 전 퇴장');
      }

      /*
       * 게임 인원이 1명인지 체크
       * */
      const tempBool = await this.gamePlayUserCheck(gameInfoIdx);

      /*
       * 게임 인원이 1명이라면 남은 인원이 게임을 승리하고 종료
       * */
      await this.gameEndMethod(gameInfoIdx, roomNumIdx, tempBool);

      console.log(tempBool);

      // console.log(userRoomNumber);
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
    //
    await this.deleteEmptyRoom();
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
    console.log(data);
    socket.join(data.roomNumber.toString());
    await this.savePlayInfo(socket, data);
  }

  // 유저 정보를 방목록 별로 저장
  //@SubscribeMessage('setPlayInfo')
  async savePlayInfo(socket: Socket, data) {
    const roomInfo = await this.db.findRoom(Number(data.roomNumber));

    /*
     * 방 입장 제한 인원 수 초과 시 제한
     * */
    console.log(
      this.server.sockets.adapter.rooms.get(data.roomNumber.toString()),
    );
    if (
      this.server.sockets.adapter.rooms.get(data.roomNumber.toString()).size >
      roomInfo.room_max_user
    ) {
      socket.emit('joinError');
      console.log('인원수 초과');
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

  /*
   * host 게임 시작 버튼 클릭 시, user 게임 준비 버튼
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
    this.gameInfo.forEach((data) => {
      console.log(data.userDiceTurn);
    });
    this.roomInfo.forEach((data) => {
      console.log(data);
    });
  }

  async setGamePlayInfo(data) {
    const playUserInfo = this.roomInfo[data.roomInfoIdx];

    const userPlayInfoArray = [];
    const userPlayScoreArray = [];

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
        userTurnCheck: false,
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
        bonus: 0,
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
      userDiceTurn: this.roomInfo[data.roomInfoIdx].userList.concat(),
      userYahtScore: userPlayScoreArray,
      gameRound: 0,
      userDiceSet: {
        throwDice: true,
        diceCount: 30,
      },
    });

    /*
     * 주사위 턴 알림
     * */
    this.server.in(data.roomNumber.toString()).emit('diceTurn', {
      message: 'diceTurn',
      diceTurn: this.roomInfo[data.roomInfoIdx].userList[0],
    });
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
        this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
          gameInfoIdx.userPlayInfoIdx
        ][data.scoreType] = Number(data.scoreValue); // user 점수 object에 해당 점수 저장
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.shift(); // 턴의 첫 번째 순서를 바꿈 (배열 첫 번째 값을 지운다)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.push(
          socket['userId'],
        ); // (배열 끝에 아이디를 추가함)
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = true; // 주사위를 던질 수 있는 조건을 바꿈
        this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] = 30; // 주사위를 바꿀 수 있는 횟수를 변경
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
          gameInfoIdx.userPlayInfoIdx
        ]['userTurnCheck'] = true; // 해당 라운드에 유저가 턴을 마쳤는지 판단 true : 턴 마침, false : 진행 전
        this.server.sockets
          .in(roomNumIdx.roomNumber.toString())
          .emit('userScoreBoard', scoreBoard); // 다음 턴 유저 점수판 전송
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
          gameInfoIdx.userPlayInfoIdx
        ]['userScore'] += Number(data.scoreValue); // 유저가 선택한 점수를 더함
        await this.checkBonusScore(gameInfoIdx); // 보너스 점수 체크

        /*
         * 라운드 증가
         * */
        //this.gameRoundUpdate(gameInfoIdx); // 라운드 증가

        /*
         * 유저 턴 체크
         * */
        await this.playInfoTurnCheck(gameInfoIdx);

        this.server.in(roomNumIdx.roomNumber.toString()).emit(
          'userScoreInfo',
          this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo, // 현재 진행중인 room의 유저들 아이디, 이름, 점수(확인필요) 를 전달함
        );
        this.server.in(roomNumIdx.roomNumber.toString()).emit('diceTurn', {
          message: 'diceTurn',
          diceTurn: this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0], // 현재 주사위 턴 유저 전달
        });

        /*
         * 게임 마무리 체크
         * */

        // if (
        //   this.gameInfo[gameInfoIdx.gameInfoIdx].gameRound ==
        //   this.gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn.length * 3 // 게임 라운드
        // ) {
        //   console.log('게임 끝');
        //   const result = this.gameInfo[
        //     gameInfoIdx.gameInfoIdx
        //   ].userPlayInfo.sort((a, b) => {
        //     return a['userScore'] - b['userScore'];
        //   });
        //   this.server.sockets
        //     .in(roomNumIdx.roomNumber.toString())
        //     .emit('gameEnd', result.reverse()); // 점수별 순위 내림차순 전달
        // }

        // if (await this.gameEndCheck(gameInfoIdx)) {
        //   console.log('게임 끝');
        //   const result = this.gameInfo[
        //     gameInfoIdx.gameInfoIdx
        //   ].userPlayInfo.sort((a, b) => {
        //     return a['userScore'] - b['userScore'];
        //   });
        //   this.server.sockets
        //     .in(roomNumIdx.roomNumber.toString())
        //     .emit('gameEnd', result.reverse()); // 점수별 순위 내림차순 전달
        // }

        await this.gameEndMethod(
          gameInfoIdx,
          roomNumIdx,
          await this.gameEndCheck(gameInfoIdx),
        );
      } else {
        console.log('이미 입력된 점수');
        socket.emit('error', {
          message: '이미 입력된 점수입니다.',
        });
      }
    }
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
    return result;
  }

  // 주사위를 던졌을 때 점수 가져오기
  async refreshScoreBoard(data) {
    const dice = [
      data.diceResult.firstDice,
      data.diceResult.secDice,
      data.diceResult.trdDice,
      data.diceResult.fothDice,
      data.diceResult.fithDice,
    ];
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
        let temp = 3;
        for (let j = 0; j < 3; j++) {
          smallSt2[i][j] += temp;
          temp--;
        }
        // smallSt2[i][0] += 3;
        // smallSt2[i][1] += 2;
        // smallSt2[i][2] += 1;
      }
      //console.log(smallSt2);
      for (let i = 0; i < smallSt2.length; i++) {
        for (let j = 0; j < smallStVal.length; j++) {
          if (smallSt2[i].filter((list) => smallStVal[j] === list).length >= 4)
            small_straight = 35;
        }
      }
      const largeSt = diceSort;
      let temp = 4;
      for (let i = 0; i < 4; i++) {
        largeSt[i] += temp;
        temp--;
      }
      // largeSt[0] += 4;
      // largeSt[1] += 3;
      // largeSt[2] += 2;
      // largeSt[3] += 1;

      for (let i = 0; i < 2; i++) {
        if (largeSt.filter((list) => smallStVal[i + 1] === list).length >= 5)
          large_straight = 40;
      }
    } else if (diceSort.length >= 4) {
      const smallSt1 = [];
      for (let i = 0; i < diceSort.length; i++) {
        smallSt1.push(diceSort[i]);
      }
      let temp = 3;
      for (let i = 0; i < 3; i++) {
        smallSt1[i] += temp;
        temp--;
      }
      // smallSt1[0] += 3;
      // smallSt1[1] += 2;
      // smallSt1[2] += 1;
      for (let i = 0; i < smallStVal.length; i++) {
        if (smallSt1.filter((list) => smallStVal[i] === list).length >= 4) {
          small_straight = 35;
        }
      }
    }

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

    // console.log(scoreBoard);

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

    /*
     * 유저가 선택한 점수 제외
     * */
    for (let i = 1; i <= Object.values(scoreObject).length; i++) {
      if (Object.entries(scoreBoard)[i][1] === null) {
        scoreObject[Object.entries(scoreBoard)[i][0].toString()] =
          scoreObject[Object.entries(scoreBoard)[i][0].toString()];
        picked.push(null);
      } else {
        scoreObject[Object.entries(scoreBoard)[i][0].toString()] =
          scoreBoard[Object.entries(scoreBoard)[i][0].toString()];
        picked.push(Object.entries(scoreBoard)[i][0].toString());
      }
    }

    let pick = picked.filter((data) => data !== null);
    pick = pick.filter((data) => data !== 'bonus');
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

  /*
   * 보너스 점수 체크
   * */
  private async checkBonusScore(gameInfoIdx) {
    const tempData =
      this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ];
    const bonus =
      tempData['ones'] +
        tempData['twos'] +
        tempData['threes'] +
        tempData['fours'] +
        tempData['fives'] +
        tempData['sixes'] >=
      63
        ? 35
        : 0;

    if (
      this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ]['bonus'] == 0
    ) {
      this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ]['bonus'] = bonus;

      this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
        gameInfoIdx.userPlayInfoIdx
      ]['userScore'] += Number(bonus);
    }
  }

  /*
   * 게임 점수 마무리 체크
   * */
  private async gameEndCheck(gameInfoIdx) {
    let bool = true;
    // console.log('gameEndCheck',this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore);
    this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.forEach((data) => {
      for (const [key, value] of Object.entries(data)) {
        if (value === null) {
          bool = false;
        }
      }
    });

    return bool;
  }

  /*
   * 유저 턴 체크
   * */
  private async playInfoTurnCheck(gameInfoIdx) {
    if (
      this.gameInfo[gameInfoIdx.gameInfoIdx].gameRound %
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.length ===
      0
    ) {
      let check = false;
      await this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.forEach(
        (list) => {
          if (!list['userTurnCheck']) {
            check = false;
          } else {
            check = true;
          }
        },
      );
      if (check) {
        console.log('현재 라운드 턴 마무리');

        // console.log('라운드 증가');
        // await this.gameRoundUpdate({
        //   gameInfoIdx: gameInfoIdx.gameInfoIdx,
        //   userPlayInfoIdx: gameInfoIdx.userPlayInfoIdx,
        // });

        await this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.forEach(
          (list, index) => {
            list['userTurnCheck'] = false;
          },
        );
      }
    }
  }

  /*
   * 게임 라운드 증가
   * */
  private gameRoundUpdate(gameInfoIdx: {
    gameInfoIdx: number;
    userPlayInfoIdx: number;
  }) {
    this.gameInfo[gameInfoIdx.gameInfoIdx].gameRound += 1;
  }

  private async gamePlayUserCheck(gameInfoIdx) {
    // console.log(
    //   '=====================================================================',
    // );
    // console.log(this.gameInfo[data.gameInfoIdx]);
    // // console.log(
    // //   'userPlayInfo > ',
    // //   this.gameInfo[data.gameInfoIdx].userPlayInfo,
    // // );
    // // console.log(
    // //   'userDiceTurn > ',
    // //   this.gameInfo[data.gameInfoIdx].userDiceTurn,
    // // );
    // // console.log(
    // //   'userYahtScore > ',
    // //   this.gameInfo[data.gameInfoIdx].userYahtScore,
    // // );
    // // console.log('userDiceSet > ', this.gameInfo[data.gameInfoIdx].userDiceSet);
    // console.log(
    //   '=====================================================================',
    // );
    //
    let bool = false;
    try {
      const roomInfo = await this.db.findRoom(
        Number(this.gameInfo[gameInfoIdx.gameInfoIdx].roomNumber),
      );
      console.log(roomInfo);
      if (
        this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.length <= 1 &&
        roomInfo.room_state === 'start'
      ) {
        console.log('roomState', roomInfo.room_state);
        bool = true;
      }
    } catch (e) {}
    return bool;
  }

  private async gameEndMethod(gameInfoIdx, roomNumIdx, bool) {
    if (bool) {
      console.log('게임 끝');
      const result = this.gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.sort(
        (a, b) => {
          return a['userScore'] - b['userScore'];
        },
      );
      this.server.sockets
        .in(roomNumIdx.roomNumber.toString())
        .emit('gameEnd', result.reverse()); // 점수별 순위 내림차순 전달

      // db에서 room 삭제
      this.db.deleteRoom(roomNumIdx.roomNumber.toString());
    }
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

  private async deleteEmptyRoom() {
    // if (this.roomInfo[roomNumIdx.roomInfoIdx].userInfo.length <= 0) {
    //
    // }
    // await this.roomInfo.forEach((data, index) => {
    //   if (data.userInfo.length <= 0) {
    //     try {
    //       this.db.deleteRoom(this.roomInfo[index].roomNumber);
    //     } catch (e) {
    //       console.log('room 삭제 에러', e);
    //     }
    //     this.roomInfo.splice(index, 1);
    //   }
    // });

    for (let i = 0; i < this.roomInfo.length; i++) {
      if (this.roomInfo[i].userInfo.length <= 0) {
        try {
          await this.db.deleteRoom(this.roomInfo[i].roomNumber);
        } catch (e) {
          console.log('room 삭제 에러', e);
        }
        this.roomInfo.splice(i, 1);
      }
    }
    this.gameInfo.forEach((data, index) => {
      if (data.userPlayInfo.length <= 0) {
        this.gameInfo.splice(index, 1);
      }
    });
    this.server.emit('refreshRoom', await this.db.getRoomList());
  }
}
