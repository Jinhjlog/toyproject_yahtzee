import { IsString } from 'class-validator';

export class SaveScoreWsPlayDto {
  @IsString()
  scoreType: string;

  @IsString()
  scoreValue: string;
}
