import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategyUser } from './access/jwt.strategy.user';
import { JwtStrategyRefresh } from './refresh/jwt.strategy.refresh';
import { JwtStrategyAdmin } from "./admin/jwt.strategy.admin";

@Module({
  providers: [JwtService, JwtStrategyUser, JwtStrategyRefresh, JwtStrategyAdmin],
})
export class AuthModule {}
