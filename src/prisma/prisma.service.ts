import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
}
