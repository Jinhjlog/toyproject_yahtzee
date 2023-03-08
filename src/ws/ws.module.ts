import { Module } from '@nestjs/common';
import { WsAdapter } from './ws.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { WsPlayAdapter } from './ws.play.adapter';

@Module({
  imports: [PrismaModule],
  providers: [WsAdapter, WsPlayAdapter],
})
export class WsModule {}
