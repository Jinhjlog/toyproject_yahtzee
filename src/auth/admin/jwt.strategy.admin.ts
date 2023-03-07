import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUserPayload } from '../access/jwt.user.payload';

@Injectable()
export class JwtStrategyAdmin extends PassportStrategy(Strategy, 'admin') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'admin',
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtUserPayload) {
    const user = payload.user_email === 'admin';

    if (user) {
      return payload;
    } else {
      throw new UnauthorizedException('접근 오류');
    }
  }
}
