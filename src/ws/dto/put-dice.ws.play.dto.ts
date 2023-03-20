import { IsArray } from 'class-validator';

export class PutDiceWsPlayDto {
  @IsArray()
  diceResult: Array<boolean>;

  @IsArray()
  diceIndex: Array<number>;
}
