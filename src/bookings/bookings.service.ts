import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { BookingStatus } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BookingsService {
  private pendingTtlMinutes: number;

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    configService: ConfigService,
  ) {
    this.pendingTtlMinutes = parseInt(
      configService.get<string>('BOOKING_PENDING_TTL_MINUTES') || '10',
      10,
    );
  }

  async createBooking(passengerId: string, dto: CreateBookingDto) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: dto.operatorId },
    });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }
    const existing = await this.prisma.booking.findFirst({
      where: {
        passengerId,
        operatorId: operator.id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('You already have an active booking');
    }
    if (!operator.isActive) {
      throw new BadRequestException('Bus is not active');
    }
    if (!operator.seatCount || operator.seatCount <= 0) {
      throw new BadRequestException('Bus profile is incomplete');
    }
    if (dto.seatsRequested > operator.seatCount) {
      throw new BadRequestException('Seat request exceeds capacity');
    }

    const expiresAt = new Date(
      Date.now() + this.pendingTtlMinutes * 60 * 1000,
    );

    const booking = await this.prisma.booking.create({
      data: {
        passengerId,
        operatorId: operator.id,
        seatsRequested: dto.seatsRequested,
        status: BookingStatus.PENDING,
        expiresAt,
        ...this.buildPassengerLocation(dto),
      },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
    });

    await this.realtimeGateway.emitBookingCreated(booking);
    return booking;
  }

  async getPassengerBookings(passengerId: string) {
    return this.prisma.booking.findMany({
      where: { passengerId },
      include: {
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelBooking(passengerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { operator: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.passengerId !== passengerId) {
      throw new ForbiddenException('Not allowed');
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException('Cannot cancel booking');
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELED },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
    });

    await this.realtimeGateway.emitBookingUpdated(updated);
    return updated;
  }

  async getOperatorPending(operatorUserId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId: operatorUserId },
    });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }
    return this.prisma.booking.findMany({
      where: { operatorId: operator.id, status: BookingStatus.PENDING },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOperatorActive(operatorUserId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId: operatorUserId },
    });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }
    return this.prisma.booking.findMany({
      where: {
        operatorId: operator.id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async confirmBooking(operatorUserId: string, bookingId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId: operatorUserId },
    });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          operator: {
            select: { id: true, seatCount: true },
          },
          passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      if (booking.operatorId !== operator.id) {
        throw new ForbiddenException('Not allowed');
      }
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException('Booking not pending');
      }

      await tx.$queryRaw`SELECT "id" FROM "OperatorProfile" WHERE "id" = ${operator.id} FOR UPDATE`;

      const confirmedSeats = await tx.booking.aggregate({
        where: {
          operatorId: operator.id,
          status: BookingStatus.CONFIRMED,
        },
        _sum: { seatsRequested: true },
      });
      const used = confirmedSeats._sum.seatsRequested || 0;
      if (operator.seatCount != null && used + booking.seatsRequested > operator.seatCount) {
        throw new BadRequestException('Capacity exceeded');
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
        include: {
          passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
          operator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              busType: true,
              seatCount: true,
              plateNumber: true,
            },
          },
          rating: { select: { score: true, comment: true, createdAt: true } },
        },
      });
    });

    await this.realtimeGateway.emitBookingUpdated(updated);
    return updated;
  }

  async rejectBooking(operatorUserId: string, bookingId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId: operatorUserId },
    });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { passenger: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.operatorId !== operator.id) {
      throw new ForbiddenException('Not allowed');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking not pending');
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.REJECTED },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
    });
    await this.realtimeGateway.emitBookingUpdated(updated);
    return updated;
  }

  private buildPassengerLocation(dto: CreateBookingDto) {
    if (dto.passengerLat == null || dto.passengerLng == null) {
      return {};
    }
    return {
      passengerLat: dto.passengerLat,
      passengerLng: dto.passengerLng,
      passengerLocationAt: new Date(),
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireBookings() {
    const now = new Date();
    const expired = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lt: now },
      },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
      },
    });

    for (const booking of expired) {
      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
        include: {
          passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
          operator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              busType: true,
              seatCount: true,
              plateNumber: true,
            },
          },
          rating: { select: { score: true, comment: true, createdAt: true } },
        },
      });
      await this.realtimeGateway.emitBookingUpdated(updated);
    }
  }

  async createRating(passengerId: string, bookingId: string, dto: CreateRatingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { rating: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.passengerId !== passengerId) {
      throw new ForbiddenException('Not allowed');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking must be confirmed');
    }
    if (booking.rating) {
      throw new BadRequestException('Booking already rated');
    }

    await this.prisma.rating.create({
      data: {
        bookingId: booking.id,
        operatorId: booking.operatorId,
        passengerId,
        score: dto.score,
        comment: dto.comment?.trim() || null,
      },
    });

    return this.prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
        operator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            busType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
        rating: { select: { score: true, comment: true, createdAt: true } },
      },
    });
  }
}

