import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { treeKillSync } from '@nestjs/cli/lib/utils/tree-kill';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }

  // 회원가입
  async signUp(data) {
    return this.user.create({
      data: data,
    });
  }

  // 로그인
  async signIn(data) {
    return this.user.findUnique({
      where: {
        user_email: data.user_email,
      },
      select: {
        user_id: true,
        user_email: true,
        user_pw: true,
        user_name: true,
      },
    });
  }

  // 유저 이메일 전부 불러오기
  async getUserEmail() {
    return this.user.findMany({
      select: {
        user_email: true,
      },
    });
  }

  // 특정 유저 회원 정보 불러오기
  async getUserInfo(data) {
    return this.user.findUnique({
      where: {
        user_id: data.user_id,
      },
      select: {
        user_id: true,
        user_email: true,
        user_name: true,
      },
    });
  }

  //Token db
  async setToken(data) {
    return this.token.create({
      data: data,
    });
  }

  async findUserToken(data) {
    return this.token.findUnique({
      where: {
        user_email: data.user_email,
      },
    });
  }

  async updateToken(data) {
    return this.token.update({
      where: {
        user_email: data.user_email,
      },
      data: data,
    });
  }

  async deleteToken(data) {
    return this.token.delete({
      where: {
        user_email: data.user_email,
      },
    });
  }

  // room db start
  async getRoomHostId() {
    return this.room.findMany({
      select: {
        room_id: true,
        user_id: true,
      },
    });
  }

  async createRoom(data) {
    return this.room.create({
      data: data,
    });
  }

  async getRoomList() {
    return this.room.findMany({
      select: {
        room_id: true,
        user_id: true,
        user_name: true,
        room_name: true,
        room_state: true,
        room_user_count: true,
        room_max_user: true,
      },
      where: {
        room_state: 'waiting',
      },
    });
  }

  async userJoinRoom(roomId) {
    return this.room.update({
      where: {
        room_id: roomId,
      },
      data: {
        room_user_count: { increment: 1 },
      },
    });
  }

  async userQuitRoom(roomId: number) {
    return this.room.update({
      where: {
        room_id: roomId,
      },
      data: {
        room_user_count: { decrement: 1 },
      },
    });
  }

  async deleteRoom(roomId) {
    return this.room.deleteMany({
      where: {
        room_id: Number(roomId),
      },
    });
  }

  async findRoom(roomId) {
    return this.room.findUnique({
      where: {
        room_id: roomId,
      },
    });
  }

  async startGame(roomId) {
    return this.room.update({
      where: {
        room_id: roomId,
      },
      data: {
        room_state: 'start',
      },
    });
  }

  async changeHost(data) {
    return this.room.update({
      where: {
        room_id: Number(data.roomId),
      },
      data: {
        user_id: data.userId,
        user_name: data.user_name,
      },
    });
  }
  // room db end
}
