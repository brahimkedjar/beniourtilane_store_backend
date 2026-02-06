import { IsOptional, IsString } from 'class-validator';

export class CreateRentalConversationDto {
  @IsOptional()
  @IsString()
  listingId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}
