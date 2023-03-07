import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUserPayload } from './jwt.user.payload';

@Injectable()
export class JwtStrategyUser extends PassportStrategy(Strategy, 'user') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'user',
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
