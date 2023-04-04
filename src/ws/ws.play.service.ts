import { GameSetWsEntity } from './entities/game-set-ws.entity';
import { GamePlayWsEntity } from './entities/game-play-ws.entity';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { Socket } from 'socket.io';

export class WsPlayService {
  @Inject()
  private db: PrismaService;

  /*
   * 유저가 방을 나갔을 때 roomInfo Entity에 있는 유저 정보를 삭제함
   * */
  async removeRoomInfo(roomInfo, roomNumIdx) {
    try {
      roomInfo[roomNumIdx.roomInfoIdx].userInfo.splice(
        roomNumIdx.userInfoIdx,
        1,
      );
      roomInfo[roomNumIdx.roomInfoIdx].userList.splice(
        roomNumIdx.userInfoIdx,
        1,
      );
    } catch (e) {
      console.log('removeRoomInfo Error');
    }
  }

  /*
   * 유저가 게임 중 방을 나갔을 때 gameInfo Entity에 있는 유저 정보를 삭제함
   * */
  async removeGameInfo(gameInfo, gameInfoIdx, socket) {
    try {
      gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.splice(
        gameInfoIdx.userPlayInfoIdx,
        1,
      );
      gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.splice(
        gameInfoIdx.userPlayInfoIdx,
        1,
      );
      gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn = gameInfo[
        gameInfoIdx.gameInfoIdx
      ].userDiceTurn.filter((data) => data !== socket['userId']);
    } catch (e) {
      console.log('removeGameInfo Error');
    }
  }

  /*
   * 게임 인원이 1명인지 체크
   * */
  async gamePlayUserCheck(gameInfo, gameInfoIdx) {
    let bool = false;
    try {
      const roomInfo = await this.db.findRoom(
        Number(gameInfo[gameInfoIdx.gameInfoIdx].roomNumber),
      );
      if (
        gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.length <= 1 &&
        roomInfo.room_state === 'start'
      ) {
        bool = true;
      }
    } catch (e) {
      console.log('gamePlayUserCheck Error');
    }
    return bool;
  }

  /*
   * 게임 끝 메소드
   * */
  async gameEndMethod(gameInfo, gameInfoIdx, roomNumIdx, bool) {
    if (bool) {
      console.log('게임 끝');
      const result = gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo.sort(
        (a, b) => {
          return a['userScore'] - b['userScore'];
        },
      );
      // this.server.sockets
      //   .in(roomNumIdx.roomNumber.toString())
      //   .emit('gameEnd', result.reverse()); // 점수별 순위 내림차순 전달

      // db에서 room 삭제
      this.db.deleteRoom(roomNumIdx.roomNumber.toString());

      return result;
    }
  }

  /*
   * room에 한명도 없을 경우 room을 삭제함
   * */
  async deleteEmptyRoom(roomInfo, gameInfo) {
    for (let i = 0; i < roomInfo.length; i++) {
      if (roomInfo[i].userInfo.length <= 0) {
        try {
          await this.db.deleteRoom(roomInfo[i].roomNumber);
        } catch (e) {
          console.log('room 삭제 에러', e);
        }
        roomInfo.splice(i, 1);
      }
    }
    gameInfo.forEach((data, index) => {
      if (data.userPlayInfo.length <= 0) {
        gameInfo.splice(index, 1);
      }
    });
  }

  /*
   * 유저 정보를 방 목록 별로 저장
   * */
  async savePlayInfo(socket, roomInfo, data) {
    await this.db.userJoinRoom(Number(data.roomNumber));

    socket['userId'] = data.userId;
    socket['userRole'] = 'user';
    socket['userName'] = data.userName;

    let index;
    for (let i = 0; i < roomInfo.length; i++) {
      if (roomInfo[i].roomNumber == data.roomNumber) {
        index = i;
      }
    }

    /*
     * roomInfo 배열에 유저 정보 저장
     * */
    roomInfo[index].userInfo.push({
      socId: [...socket.rooms][0],
      userId: data.userId,
      userName: data.userName,
      userState: 'none',
      userRole: 'user',
    });

    roomInfo[index].userList.push(data.userId);
  }

  /*
   * 방장 게임 시작 버튼
   * */
  async hostGameStartBtn(socket, roomInfo) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    let bool = false;
    const noneList = [];
    if (roomInfo[roomNumIdx.roomInfoIdx].userInfo.length >= 2) {
      bool = true;
      roomInfo[roomNumIdx.roomInfoIdx].userInfo.forEach((list) => {
        if (list['userState'] != 'ready') {
          noneList.push(list['userName']);
          bool = false;
        }
      });
    }
    return {
      bool: bool,
      noneList: noneList,
      roomNumIdx: roomNumIdx,
      roomInfoIdx: roomNumIdx.roomInfoIdx,
    };
  }

  /*
   * 유저 게임 준비 버튼
   * */
  async userGameReadyBtn(socket, roomInfo) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    /*
     * 유저 준비 상태에 따른 준비, 준비 취소
     * */
    roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
      'userState'
    ] == 'none'
      ? (roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
          'userState'
        ] = 'ready')
      : (roomInfo[roomNumIdx.roomInfoIdx].userInfo[roomNumIdx.userInfoIdx][
          'userState'
        ] = 'none');

    return {
      roomNumIdx: roomNumIdx,
    };
  }

  /*
   * 게임 시작 시 게임 진행시 필요한 데이터 세팅
   * */
  async setGamePlayInfo(socket, roomInfo, gameInfo, data) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx(gameInfo, {
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });
    const playUserInfo = roomInfo[data.roomInfoIdx];

    const userPlayInfoArray = [];
    const userPlayScoreArray = [];

    await gameInfo.forEach((list) => {
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
    gameInfo.push({
      roomNumber: roomInfo[data.roomInfoIdx].roomNumber,
      userPlayInfo: userPlayInfoArray,
      userDiceTurn: roomInfo[data.roomInfoIdx].userList.concat(),
      userYahtScore: userPlayScoreArray,
      gameRound: 0,
      userDiceSet: {
        throwDice: true,
        diceCount: 2,
      },
      throwDiceScoreResult: {
        ones: null,
        twos: null,
        threes: null,
        fours: null,
        fives: null,
        sixes: null,
        triple: null,
        four_card: null,
        full_house: null,
        small_straight: null,
        large_straight: null,
        chance: null,
        yahtzee: null,
      },
    });
  }

  /*
   * userId로 roomNumber 찾기
   * */
  private async findUserRoom(roomInfo, userId) {
    let roomNumber = null;
    let roomInfoidx = null;
    let userInfoIdx = null;
    await roomInfo.forEach((info, index) => {
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

  /*
   * roomNumber로 gameInfo 배열의 idx 찾기
   * */
  private async findGameInfoIdx(gameInfo, data) {
    // data : { roomNumber, userId }
    // data : roomNumber, userId
    let gameInfoIdx = null;
    let userPlayInfoIdx = null;
    for (let i = 0; i < gameInfo.length; i++) {
      console.log(gameInfo[i].roomNumber, ' =>', data.roomNumber);
      if (gameInfo[i].roomNumber == data.roomNumber) {
        gameInfoIdx = i;
        for (let j = 0; j < gameInfo[i].userPlayInfo.length; j++) {
          if (gameInfo[i].userPlayInfo[j]['userId'] == data.userId) {
            userPlayInfoIdx = j;
          }
        }
      }
    }
    return { gameInfoIdx: gameInfoIdx, userPlayInfoIdx: userPlayInfoIdx };
  }

  /*
   * diceTurn 새로고침
   * */
  async diceTurnRefresh(socket, gameInfo, gameInfoIdx) {
    try {
      console.log(
        gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0],
        socket['userId'],
      );
      if (
        gameInfo[gameInfoIdx.gameInfoIdx].userDiceTurn[0] == socket['userId']
      ) {
        gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['throwDice'] = true;
        gameInfo[gameInfoIdx.gameInfoIdx].userDiceSet['diceCount'] = 2;

        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.log('주사위 턴 체크');
    }
  }

  /*
   * 게임 점수 마무리 체크
   * */
  async gameEndCheck(gameInfo, gameInfoIdx) {
    let bool = true;
    // console.log('gameEndCheck',this.gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore);
    gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore.forEach((data) => {
      for (const [key, value] of Object.entries(data)) {
        if (value === null) {
          bool = false;
        }
      }
    });

    return bool;
  }

  /*
   * 보너스 점수 체크
   * */
  async checkBonusScore(gameInfo, gameInfoIdx) {
    const tempData =
      gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
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
      gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ]['bonus'] == 0
    ) {
      gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ]['bonus'] = bonus;

      gameInfo[gameInfoIdx.gameInfoIdx].userPlayInfo[
        gameInfoIdx.userPlayInfoIdx
      ]['userScore'] += Number(bonus);
    }
  }

  /*
   * 주사위를 던졌을 때 점수 가져오기
   * */
  async refreshScoreBoard(socket, roomInfo, gameInfo, data) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx(gameInfo, {
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });
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
      }
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

    for (let i = 0; i < gameInfo[data.gameInfoIdx].userYahtScore.length; i++) {
      if (
        gameInfo[data.gameInfoIdx].userYahtScore[i]['userId'] == data.userId
      ) {
        scoreBoard = gameInfo[data.gameInfoIdx].userYahtScore[i];
      }
    }
    // console.log('--------------------------------------');
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

    // // 2023-03-31 추가
    gameInfo[gameInfoIdx.gameInfoIdx].throwDiceScoreResult = {
      ones: scoreObject.ones,
      twos: scoreObject.twos,
      threes: scoreObject.threes,
      fours: scoreObject.fours,
      fives: scoreObject.fives,
      sixes: scoreObject.sixes,
      triple: scoreObject.triple,
      four_card: scoreObject.four_card,
      full_house: scoreObject.full_house,
      small_straight: scoreObject.small_straight,
      large_straight: scoreObject.large_straight,
      chance: scoreObject.chance,
      yahtzee: scoreObject.yahtzee,
    };

    return { scoreValue: scoreObject, picked: pick };
  }

  /*
   * 특정 주사위 다시 던진 결과 리턴
   * */
  async userPutDice(diceResult, data) {
    const result = diceResult;
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

  /*
   * 던진 주사위 결과 받기
   * */
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

  /*
   * (임시) 유저가 선택한 점수 목록 가져오기
   * */
  async getUserPick(scoreBoard) {
    const picked = [];
    for (let i = 1; i < Object.values(scoreBoard).length; i++) {
      if (Object.entries(scoreBoard)[i][1] === null) {
        picked.push(null);
      } else {
        picked.push(Object.entries(scoreBoard)[i][0].toString());
      }
    }

    let pick = picked.filter((data) => data !== null);
    pick = pick.filter((data) => data !== 'bonus');
    return pick;
  }

  /*
   * (임시) 현재 주사위 턴 유저 이름 전달
   * */
  async getDiceTurnName(userDiceTurn, userPlayInfo) {
    let userName;

    for (let i = 0; i < Object.values(userPlayInfo).length; i++) {
      if (Object.entries(userPlayInfo)[i][1]['userId'] == userDiceTurn) {
        userName = Object.entries(userPlayInfo)[i][1];
      }
    }

    return userName.userName;
  }

  /*
   * (임시) 유저가 선택한 점수를 가져옴
   * */
  async getPickScoreVal(socket, roomInfo, gameInfo, data) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx(gameInfo, {
      roomNumber: roomNumIdx.roomNumber,
      userId: socket['userId'],
    });

    console.log(
      `${data.scoreType}`,
      gameInfo[gameInfoIdx.gameInfoIdx].throwDiceScoreResult[data.scoreType],
    );

    return gameInfo[gameInfoIdx.gameInfoIdx].throwDiceScoreResult[
      data.scoreType
    ];
  }

  /*
   *  특정 유저 점수판을 가져옴
   * */
  async getUserScoreBoard(socket, roomInfo, gameInfo, data) {
    const roomNumIdx = await this.findUserRoom(roomInfo, socket['userId']);
    const gameInfoIdx = await this.findGameInfoIdx(gameInfo, {
      roomNumber: roomNumIdx.roomNumber,
      userId: data.userId,
    });
    console.log(
      typeof gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
        gameInfoIdx.userPlayInfoIdx
      ],
    );

    const scoreData = JSON.parse(
      JSON.stringify(
        gameInfo[gameInfoIdx.gameInfoIdx].userYahtScore[
          gameInfoIdx.userPlayInfoIdx
        ],
      ),
    );
    for (let i = 0; i < Object.values(scoreData).length; i++) {
      if (Object.entries(scoreData)[i][1] === null) {
        scoreData[`${Object.entries(scoreData)[i][0]}`] = 0;
      }
    }

    return scoreData;
  }
}
