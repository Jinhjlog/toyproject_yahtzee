import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class UserService {
  constructor(private db: PrismaService) {}

  @Inject()
  private jwtService: JwtService;

  // 회원가입
  async signUp(data) {
    // 이메일 중복체크
    const check = await this.emailDupCheck(data.user_email);
    if (!check) {
      return '이메일 중복';
    }
    data.user_pw = await this.hashPassword(data.user_pw);

    await this.db.signUp(data);
    /*
     * 데이터베이스 코드
     * */

    return '계정 생성';
  }

  // 로그인
  async signIn(data) {
    const db_data = await this.db.signIn(data);
    //onsole.log(db_data);
    if (!db_data) {
      throw new NotFoundException('Email, PW error');
    }
    const pw_check = await bcrypt.compare(data.user_pw, db_data.user_pw);
    if (!pw_check) {
      throw new NotFoundException('Email, PW error');
    }

    const payload = {
      user_email: db_data.user_email,
      user_name: db_data.user_name,
    };

    const token = await this.getToken(payload);
    /*
     * refreshToken db create 코드 작성
     * */
    return token;
  }

  async test() {
    const data = await this.db.getUserEmail();
    return data;
  }

  // bcrypt
  async hashPassword(plainText: string): Promise<string> {
    // 해싱 알고리즘 10번 반복
    const saltOrRound = 10;
    return await bcrypt.hash(plainText, saltOrRound);
  }

  // 이메일 중복체크
  async emailDupCheck(user_email): Promise<boolean> {
    let bool = true;

    const data = await this.db.getUserEmail();
    await data.forEach((list) => {
      if (user_email === list.user_email) {
        bool = false;
      }
    });
    return bool;
  }

  // 토큰발급
  async getToken(payload) {
    let adminToken = null;

    // 관리자 토큰
    if (payload.user_email === 'admin') {
      adminToken = this.jwtService.sign(payload, {
        secret: 'admin',
        expiresIn: '3h',
      });
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: 'user',
      expiresIn: '3h',
    });

    // refreshToken
    const refreshToken = this.jwtService.sign(payload, {
      secret: 'refresh',
      expiresIn: '1d',
    });

    return adminToken
      ? {
          accessToken: accessToken,
          refreshToken: refreshToken,
          adminToken: adminToken,
        }
      : { accessToken: accessToken, refreshToken: refreshToken };
  }
}
