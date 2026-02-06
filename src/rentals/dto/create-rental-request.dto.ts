import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RentalVehicleKind } from '@prisma/client';

export class CreateRentalRequestDto {
  @IsEnum(RentalVehicleKind)
  vehicleKind!: RentalVehicleKind;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seatCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
