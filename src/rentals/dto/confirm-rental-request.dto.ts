import { IsString } from 'class-validator';

export class ConfirmRentalRequestDto {
  @IsString()
  listingId!: string;
}
