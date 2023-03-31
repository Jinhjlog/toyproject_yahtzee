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
    let bool = true;
    const noneList = [];
    if (roomInfo[roomNumIdx.roomInfoIdx].userInfo.length >= 2) {
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
}
