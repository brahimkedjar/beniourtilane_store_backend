import { IsString, MaxLength } from 'class-validator';

export class SendRentalMessageDto {
  @IsString()
  @MaxLength(1000)
  message!: string;
}
