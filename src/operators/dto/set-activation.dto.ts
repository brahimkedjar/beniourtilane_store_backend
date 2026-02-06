import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ActivationMode } from '@prisma/client';

export class SetActivationDto {
  @IsEnum(ActivationMode)
  activationMode!: ActivationMode;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

