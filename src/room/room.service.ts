import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RoomService {
  constructor(private db: PrismaService) {}

  @Inject()
  private jwtService: JwtService;

  // async getRoomHostId(data) {
  //   const db_data = await this.db.getRoomHostId();
  //   return db_data;
  // }
}
