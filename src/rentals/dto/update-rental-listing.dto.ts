import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RentalListingStatus, RentalVehicleKind } from '@prisma/client';

export class UpdateRentalListingDto {
  @IsOptional()
  @IsEnum(RentalVehicleKind)
  vehicleKind?: RentalVehicleKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  seatCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableTo?: string;

  @IsOptional()
  @IsEnum(RentalListingStatus)
  status?: RentalListingStatus;
}
