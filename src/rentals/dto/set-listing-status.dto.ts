import { IsEnum } from 'class-validator';
import { RentalListingStatus } from '@prisma/client';

export class SetRentalListingStatusDto {
  @IsEnum(RentalListingStatus)
  status!: RentalListingStatus;
}
