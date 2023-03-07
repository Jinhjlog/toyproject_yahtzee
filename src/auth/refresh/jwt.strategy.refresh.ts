import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUserPayload } from '../access/jwt.user.payload';

@Injectable()
export class JwtStrategyRefresh extends PassportStrategy(
  Strategy,
  'refreshToken',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'refresh',
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtUserPayload) {
    if (payload) {
      return payload;
    } else {
      throw new UnauthorizedException('접근 오류');
    }
  }
}
