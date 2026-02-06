"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
let BookingsService = class BookingsService {
    constructor(prisma, realtimeGateway, configService) {
        this.prisma = prisma;
        this.realtimeGateway = realtimeGateway;
        this.pendingTtlMinutes = parseInt(configService.get('BOOKING_PENDING_TTL_MINUTES') || '10', 10);
    }
    async createBooking(passengerId, dto) {
        const operator = await this.prisma.operatorProfile.findUnique({
            where: { id: dto.operatorId },
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        const existing = await this.prisma.booking.findFirst({
            where: {
                passengerId,
                operatorId: operator.id,
                status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED] },
            },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.BadRequestException('You already have an active booking');
        }
        if (!operator.isActive) {
            throw new common_1.BadRequestException('Bus is not active');
        }
        if (!operator.seatCount || operator.seatCount <= 0) {
            throw new common_1.BadRequestException('Bus profile is incomplete');
        }
        if (dto.seatsRequested > operator.seatCount) {
            throw new common_1.BadRequestException('Seat request exceeds capacity');
        }
        const expiresAt = new Date(Date.now() + this.pendingTtlMinutes * 60 * 1000);
        const booking = await this.prisma.booking.create({
            data: {
                passengerId,
                operatorId: operator.id,
                seatsRequested: dto.seatsRequested,
                status: client_1.BookingStatus.PENDING,
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
    async getPassengerBookings(passengerId) {
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
    async cancelBooking(passengerId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { operator: true },
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        if (booking.passengerId !== passengerId) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (booking.status !== client_1.BookingStatus.PENDING &&
            booking.status !== client_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Cannot cancel booking');
        }
        const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: client_1.BookingStatus.CANCELED },
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
    async getOperatorPending(operatorUserId) {
        const operator = await this.prisma.operatorProfile.findUnique({
            where: { userId: operatorUserId },
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        return this.prisma.booking.findMany({
            where: { operatorId: operator.id, status: client_1.BookingStatus.PENDING },
            include: {
                passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
                rating: { select: { score: true, comment: true, createdAt: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async getOperatorActive(operatorUserId) {
        const operator = await this.prisma.operatorProfile.findUnique({
            where: { userId: operatorUserId },
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        return this.prisma.booking.findMany({
            where: {
                operatorId: operator.id,
                status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED] },
            },
            include: {
                passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
                rating: { select: { score: true, comment: true, createdAt: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async confirmBooking(operatorUserId, bookingId) {
        const operator = await this.prisma.operatorProfile.findUnique({
            where: { userId: operatorUserId },
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
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
                throw new common_1.NotFoundException('Booking not found');
            }
            if (booking.operatorId !== operator.id) {
                throw new common_1.ForbiddenException('Not allowed');
            }
            if (booking.status !== client_1.BookingStatus.PENDING) {
                throw new common_1.BadRequestException('Booking not pending');
            }
            await tx.$queryRaw `SELECT "id" FROM "OperatorProfile" WHERE "id" = ${operator.id} FOR UPDATE`;
            const confirmedSeats = await tx.booking.aggregate({
                where: {
                    operatorId: operator.id,
                    status: client_1.BookingStatus.CONFIRMED,
                },
                _sum: { seatsRequested: true },
            });
            const used = confirmedSeats._sum.seatsRequested || 0;
            if (operator.seatCount != null && used + booking.seatsRequested > operator.seatCount) {
                throw new common_1.BadRequestException('Capacity exceeded');
            }
            return tx.booking.update({
                where: { id: booking.id },
                data: { status: client_1.BookingStatus.CONFIRMED },
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
    async rejectBooking(operatorUserId, bookingId) {
        const operator = await this.prisma.operatorProfile.findUnique({
            where: { userId: operatorUserId },
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { passenger: { select: { id: true, email: true, firstName: true, lastName: true } } },
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        if (booking.operatorId !== operator.id) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (booking.status !== client_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('Booking not pending');
        }
        const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: client_1.BookingStatus.REJECTED },
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
    buildPassengerLocation(dto) {
        if (dto.passengerLat == null || dto.passengerLng == null) {
            return {};
        }
        return {
            passengerLat: dto.passengerLat,
            passengerLng: dto.passengerLng,
            passengerLocationAt: new Date(),
        };
    }
    async expireBookings() {
        const now = new Date();
        const expired = await this.prisma.booking.findMany({
            where: {
                status: client_1.BookingStatus.PENDING,
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
                data: { status: client_1.BookingStatus.EXPIRED },
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
    async createRating(passengerId, bookingId, dto) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { rating: true },
        });
        if (!booking) {
            throw new common_1.NotFoundException('Booking not found');
        }
        if (booking.passengerId !== passengerId) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (booking.status !== client_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Booking must be confirmed');
        }
        if (booking.rating) {
            throw new common_1.BadRequestException('Booking already rated');
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
};
exports.BookingsService = BookingsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "expireBookings", null);
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_gateway_1.RealtimeGateway,
        config_1.ConfigService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map