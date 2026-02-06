import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  operatorId!: string;

  @IsInt()
  @Min(1)
  seatsRequested!: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  passengerLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  passengerLng?: number;
}
