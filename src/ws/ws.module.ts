import { Module } from '@nestjs/common';
import { WsAdapter } from './ws.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { WsPlayAdapter } from './ws.play.adapter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { WsPlayService } from './ws.play.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, JwtModule, ScheduleModule.forRoot()],
  providers: [WsAdapter, WsPlayAdapter, WsPlayService],
})
export class WsModule {}
