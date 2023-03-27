import { Module } from '@nestjs/common';
import { WsAdapter } from './ws.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { WsPlayAdapter } from './ws.play.adapter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { WsPlayService } from './ws.play.service';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [WsAdapter, WsPlayAdapter, WsPlayService],
})
export class WsModule {}
