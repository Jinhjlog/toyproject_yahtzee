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

  // room db
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
        room_name: true,
        room_state: true,
      },
    });
  }
}
