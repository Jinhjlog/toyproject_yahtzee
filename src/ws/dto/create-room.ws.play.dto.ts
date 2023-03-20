import { IsNumber, IsString } from 'class-validator';

export class CreateRoomWsPlayDto {
  @IsString()
  userId: string;

  @IsString()
  userName: string;

  @IsNumber()
  roomNumber: number;
}
