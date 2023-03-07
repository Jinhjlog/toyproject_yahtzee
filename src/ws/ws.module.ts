import { Module } from '@nestjs/common';
import { WsAdapter } from "./entities/ws.adapter";

@Module({
  providers: [WsAdapter]
})
export class WsModule {}
