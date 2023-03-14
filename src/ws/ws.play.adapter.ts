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

      let gameInfoIdx = 0;
      for (let i = 0; i < this.gameInfo.length; i++) {
        if (this.gameInfo[i].roomNumber == roomNumber) {
          gameInfoIdx = i;
        }
      }

      try {
        this.gameInfo.splice(gameInfoIdx, 1);
      } catch (e) {}

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
      } catch (e) {}

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

      let gameInfoIdx = 0;
      for (let i = 0; i < this.gameInfo.length; i++) {
        if (this.gameInfo[i].roomNumber == data.roomNumber) {
          gameInfoIdx = i;
        }
      }

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
          }),
          this.server.sockets
            .in(data.roomNumber)
            .emit(
              'userScoreBoard',
              this.gameInfo[gameInfoIdx].userYahtScore[0],
            ))
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
    // console.log(this.gameInfo);
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

    this.gameInfo.push({
      roomNumber: this.roomInfo[data.roomInfoIdx].roomNumber,
      userPlayInfo: userPlayInfoArray,
      userDiceTurn: this.roomInfo[data.roomInfoIdx].userList,
      userYahtScore: userPlayScoreArray,
      gameRound: 1,
      userDiceSet: {
        throwDice: true,
        diceCount: 99,
      },
    });
  }

  @SubscribeMessage('throwDice')
  async throwDice(socket: Socket, data) {
    // data에 있어야 할 것
    // {
    //   roomNumber = 방번호
    // }

    let gameInfoIdx = 0;
    for (let i = 0; i < this.gameInfo.length; i++) {
      if (this.gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
      }
    }

    if (this.gameInfo[gameInfoIdx].userDiceTurn[0] == socket['userId']) {
      if (!this.gameInfo[gameInfoIdx].userDiceSet['throwDice']) {
        socket.emit('throwDice', {
          state: 'error',
          message: `주사위는 한번 만 던질 수 있음`,
        });
      } else {
        const diceResult = await this.userThrowDice();
        this.server.sockets.in(data.roomNumber.toString()).emit('throwDice', {
          state: 'throw',
          message: `${socket['userId']} 이(가) 주사위를 던짐`,
          diceResult: diceResult,
          scoreBoard: await this.refreshScoreBoard({
            diceResult: diceResult,
            userId: socket['userId'],
            gameInfoIdx: gameInfoIdx,
            roomNumber: data.roomNumber,
          }),
        });
        this.gameInfo[gameInfoIdx].userDiceSet['throwDice'] = false;
      }

      // 주사위 턴 변경
      // this.gameInfo[gameInfoIdx].userDiceTurn.shift();
      // this.gameInfo[gameInfoIdx].userDiceTurn.push(socket['userId']);
    } else {
      socket.emit('throwDice', {
        state: 'error',
        message: `${this.gameInfo[gameInfoIdx].userDiceTurn[0]}의 턴`,
      });
    }
  }

  // 선택한 주사위 다시 던지기
  @SubscribeMessage('putDice')
  async putDice(socket: Socket, data) {
    let gameInfoIdx;
    for (let i = 0; i < this.gameInfo.length; i++) {
      if (this.gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
      }
    }

    if (
      socket['userId'] == this.gameInfo[gameInfoIdx].userDiceTurn[0] &&
      this.gameInfo[gameInfoIdx].userDiceSet['diceCount'] > 0 &&
      data.diceResult &&
      data.diceIndex.length > 0 &&
      !this.gameInfo[gameInfoIdx].userDiceSet['throwDice']
    ) {
      // console.log(data.diceIndex);
      const diceResult = await this.userPutDice(
        data.diceResult,
        data.diceIndex,
      );
      this.gameInfo[gameInfoIdx].userDiceSet['diceCount'] -= 1;
      // console.log('result', diceResult);
      this.server.sockets.in(data.roomNumber.toString()).emit('putDice', {
        state: 'throw',
        message: `${socket['userId']} 이(가) 선택한 주사위를 다시 던짐`,
        diceResult: diceResult,
        scoreBoard: await this.refreshScoreBoard({
          diceResult: diceResult,
          userId: socket['userId'],
          gameInfoIdx: gameInfoIdx,
          roomNumber: data.roomNumber,
        }),
      });
      //await this.refreshScoreBoard({ diceResult: diceResult });
    } else {
      if (socket['userId'] == this.gameInfo[gameInfoIdx].userDiceTurn[0]) {
        if (this.gameInfo[gameInfoIdx].userDiceSet['diceCount'] <= 0) {
          socket.emit('putDice', {
            state: 'error',
            message: '남은 주사위가 없음',
          });
        } else {
          socket.emit('putDice', {
            state: 'error',
            message: '주사위가 선택되지 않음',
          });
        }
      } else {
        socket.emit('putDice', {
          state: 'error',
          message: `${this.gameInfo[gameInfoIdx].userDiceTurn[0]}의 턴`,
        });
      }
    }
    // data : 주사위 인덱스
  }

  @SubscribeMessage('saveScore')
  async endTurn(socket: Socket, data) {
    let gameInfoIdx = 0;
    for (let i = 0; i < this.gameInfo.length; i++) {
      if (this.gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
      }
    }

    // 다음사람 점수판 가져오기
    let scoreBoard;
    for (let i = 0; i < this.gameInfo[gameInfoIdx].userYahtScore.length; i++) {
      if (
        this.gameInfo[gameInfoIdx].userDiceTurn[1] ==
        this.gameInfo[gameInfoIdx].userYahtScore[i]['userId']
      ) {
        scoreBoard = this.gameInfo[gameInfoIdx].userYahtScore[i];
      }
    }
    console.log(data);
    console.log(gameInfoIdx);
    console.log(this.gameInfo[gameInfoIdx].userYahtScore.length);

    for (let i = 0; i < this.gameInfo[gameInfoIdx].userYahtScore.length; i++) {
      if (
        this.gameInfo[gameInfoIdx].userYahtScore[i]['userId'] ==
          socket['userId'] &&
        this.gameInfo[gameInfoIdx].userDiceTurn[0] == socket['userId'] &&
        !this.gameInfo[gameInfoIdx].userDiceSet['throwDice']
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
          this.server.sockets
            .in(data.roomNumber)
            .emit('userScoreBoard', scoreBoard);
        } else {
          console.log('이미 저장된 점수');
        }
      }
    }

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
    console.log(result);
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
    let triple = 0,
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

    const scoreObject = {
      ones: dice.filter((data) => 1 === data).length * 1,
      twos: dice.filter((data) => 2 === data).length * 2,
      threes: dice.filter((data) => 3 === data).length * 3,
      fours: dice.filter((data) => 4 === data).length * 4,
      fives: dice.filter((data) => 5 === data).length * 5,
      sixes: dice.filter((data) => 6 === data).length * 6,

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

    //----------------------------------------
    // 유저 현재 점수 가져오기
    let scoreBoard;
    let picked = [];

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
    console.log(scoreBoard);

    scoreObject.ones = scoreBoard.ones === null ? scoreObject.ones : scoreBoard.ones;
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
    return { scoreValue: scoreObject, picked: pick };

    //bonus = ones + twos + threes + fours + fives + sixes >= 63 ? 35 : 0;
  }
}
