import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../common/roles.enum';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RentalsService } from './rentals.service';
import { CreateRentalListingDto } from './dto/create-rental-listing.dto';
import { UpdateRentalListingDto } from './dto/update-rental-listing.dto';
import { SetRentalListingStatusDto } from './dto/set-listing-status.dto';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { ConfirmRentalRequestDto } from './dto/confirm-rental-request.dto';
import { CreateRentalConversationDto } from './dto/create-rental-conversation.dto';
import { SendRentalMessageDto } from './dto/send-rental-message.dto';

@ApiTags('rentals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private rentalsService: RentalsService) {}

  @Get('listings')
  @Roles(UserRole.PASSENGER, UserRole.OPERATOR)
  listListings(
    @CurrentUser() user: any,
    @Query() query: { status?: string; kind?: string; mine?: string },
  ) {
    return this.rentalsService.listListings(user, query);
  }

  @Post('listings')
  @Roles(UserRole.OPERATOR)
  createListing(@CurrentUser() user: any, @Body() dto: CreateRentalListingDto) {
    return this.rentalsService.createListing(user.id, dto);
  }

  @Patch('listings/:id')
  @Roles(UserRole.OPERATOR)
  updateListing(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateRentalListingDto,
  ) {
    return this.rentalsService.updateListing(user.id, id, dto);
  }

  @Patch('listings/:id/status')
  @Roles(UserRole.OPERATOR)
  setListingStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SetRentalListingStatusDto,
  ) {
    return this.rentalsService.setListingStatus(user.id, id, dto.status);
  }

  @Get('requests')
  @Roles(UserRole.OPERATOR)
  listRequests(
    @CurrentUser() user: any,
    @Query() query: { status?: string },
  ) {
    return this.rentalsService.listRequestsForOperator(user.id, query.status);
  }

  @Get('requests/mine')
  @Roles(UserRole.PASSENGER)
  listMyRequests(@CurrentUser() user: any) {
    return this.rentalsService.listRequestsForPassenger(user.id);
  }

  @Post('requests')
  @Roles(UserRole.PASSENGER)
  createRequest(@CurrentUser() user: any, @Body() dto: CreateRentalRequestDto) {
    return this.rentalsService.createRequest(user.id, dto);
  }

  @Post('requests/:id/confirm')
  @Roles(UserRole.OPERATOR)
  confirmRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ConfirmRentalRequestDto,
  ) {
    return this.rentalsService.confirmRequest(user.id, id, dto.listingId);
  }

  @Patch('requests/:id/reject')
  @Roles(UserRole.OPERATOR)
  rejectRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rentalsService.rejectRequest(user.id, id);
  }

  @Patch('requests/:id/cancel')
  @Roles(UserRole.PASSENGER)
  cancelRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rentalsService.cancelRequest(user.id, id);
  }

  @Get('conversations')
  @Roles(UserRole.PASSENGER, UserRole.OPERATOR)
  listConversations(@CurrentUser() user: any) {
    return this.rentalsService.listConversations(user);
  }

  @Post('conversations')
  @Roles(UserRole.PASSENGER, UserRole.OPERATOR)
  createConversation(
    @CurrentUser() user: any,
    @Body() dto: CreateRentalConversationDto,
  ) {
    return this.rentalsService.createConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  @Roles(UserRole.PASSENGER, UserRole.OPERATOR)
  getMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rentalsService.getMessages(user, id);
  }

  @Post('conversations/:id/messages')
  @Roles(UserRole.PASSENGER, UserRole.OPERATOR)
  sendMessage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SendRentalMessageDto,
  ) {
    return this.rentalsService.sendMessage(user, id, dto.message);
  }
}
