import { GameSetWsEntity } from './entities/game-set-ws.entity';
import { GamePlayWsEntity } from './entities/game-play-ws.entity';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';

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
   *
   * */
}
