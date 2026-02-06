import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../common/roles.enum';
import { CurrentUser } from '../common/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateRatingDto } from './dto/create-rating.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.PASSENGER)
  create(@CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.id, dto);
  }

  @Get('my')
  @Roles(UserRole.PASSENGER)
  myBookings(@CurrentUser() user: any) {
    return this.bookingsService.getPassengerBookings(user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.PASSENGER)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.cancelBooking(user.id, id);
  }

  @Post(':id/rating')
  @Roles(UserRole.PASSENGER)
  rate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.bookingsService.createRating(user.id, id, dto);
  }

  @Get('operator/pending')
  @Roles(UserRole.OPERATOR)
  pending(@CurrentUser() user: any) {
    return this.bookingsService.getOperatorPending(user.id);
  }

  @Get('operator/active')
  @Roles(UserRole.OPERATOR)
  active(@CurrentUser() user: any) {
    return this.bookingsService.getOperatorActive(user.id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.OPERATOR)
  confirm(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.confirmBooking(user.id, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.OPERATOR)
  reject(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.rejectBooking(user.id, id);
  }
}
