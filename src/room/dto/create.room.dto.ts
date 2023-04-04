import { IsNumber, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsNumber()
  readonly user_id: number;

  @IsString()
  readonly roomName: string;

  @IsNumber()
  readonly room_max_user: number;
}
