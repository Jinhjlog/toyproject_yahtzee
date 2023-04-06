import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { use } from 'passport';
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

    /*
     * 데이터베이스 코드
     * */
    await this.db.signUp(data);

    return '계정 생성';
  }

  // 로그인
  async signIn(data) {
    const db_data = await this.db.signIn(data);
    if (!db_data) {
      throw new NotFoundException('Email, PW error');
    }
    const pw_check = await bcrypt.compare(data.user_pw, db_data.user_pw);
    if (!pw_check) {
      throw new NotFoundException('Email, PW error');
    }

    const payload = {
      user_id: db_data.user_id,
      user_email: db_data.user_email,
      user_name: db_data.user_name,
    };

    const token = await this.getToken(payload);
    /*
     * refreshToken db create 코드 작성
     * */
    const setToken = { user_email: payload.user_email, ...token };

    try {
      await this.db.setToken(setToken);
    } catch (e) {
      await this.db.deleteToken({
        user_email: db_data.user_email,
      });
      await this.db.setToken(setToken);
    }
    return token;
  }

  async test(data) {
    const a = await this.db.findRoom(Number(data.num));
    console.log(a);
    return 'ASD';
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
          access_token: accessToken,
          refresh_token: refreshToken,
          admin_token: adminToken,
        }
      : { access_token: accessToken, refresh_token: refreshToken };
  }

  async updateToken(headers) {
    let userInfo = headers.authorization.substring(7);
    userInfo = this.jwtService.decode(userInfo);

    const payload = {
      user_id: userInfo.user_id,
      user_email: userInfo.user_email,
      user_name: userInfo.user_name,
    };

    const db_data = await this.db.findUserToken(userInfo);
    if (!db_data) {
      throw new NotFoundException('not Found refreshToken');
    }

    let adminToken = null;

    // 관리자 토큰
    if (userInfo.user_email === 'admin') {
      adminToken = this.jwtService.sign(payload, {
        secret: 'admin',
        expiresIn: '3h',
      });
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: 'user',
      expiresIn: '3h',
    });

    const insertDBData = adminToken
      ? {
          access_token: accessToken,
          admin_token: adminToken,
        }
      : { access_token: accessToken };

    await this.db.updateToken({
      user_email: userInfo.user_email,
      ...insertDBData,
    });

    return insertDBData;
  }
  async getAccessToken(headers) {
    const userRefreshToken = headers.authorization.substring(7);
    const userInfo = await this.jwtService.decode(userRefreshToken);

    /*
     * db에 해당 유저의 리프레시 토큰이 존재 하는지 확인
     * */
    const db_data = await this.db.findUserToken(userInfo);
    if (!db_data || userRefreshToken !== db_data.refresh_token) {
      return 0;
    }

    const payload = {
      user_id: userInfo['user_id'],
      user_email: userInfo['user_email'],
      user_name: userInfo['user_name'],
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: 'user',
      expiresIn: '3h',
    });

    await this.db.updateToken({
      user_email: userInfo['user_email'],
      ...{
        access_token: accessToken,
      },
    });

    return {
      access_token: accessToken,
    };
  }

  async getRefreshToken(headers) {
    const userAccessToken = headers.authorization.substring(7);
    const userInfo = await this.jwtService.decode(userAccessToken);

    /*
     * db에 해당 유저의 Access 토큰이 존재 하는지 확인
     * */
    const db_data = await this.db.findUserToken(userInfo);
    if (!db_data || userAccessToken !== db_data.access_token) {
      return 0;
    }

    const payload = {
      user_id: userInfo['user_id'],
      user_email: userInfo['user_email'],
      user_name: userInfo['user_name'],
    };

    const refreshToken = this.jwtService.sign(payload, {
      secret: 'refresh',
      expiresIn: '1d',
    });

    await this.db.updateToken({
      user_email: userInfo['user_email'],
      ...{
        refresh_token: refreshToken,
      },
    });

    return {
      refresh_token: refreshToken,
    };
  }

  async signOut(headers) {
    let userInfo = headers.authorization.substring(7);
    userInfo = this.jwtService.decode(userInfo);

    let db_data;
    try {
      db_data = await this.db.deleteToken({
        user_email: userInfo.user_email,
      });
    } catch (e) {
      console.log('db에 유저가 존재하지 않음');
    }

    if (!db_data) {
      throw new NotFoundException('not Found User');
    }

    return `${db_data.user_email} user signOut`;
  }
}
