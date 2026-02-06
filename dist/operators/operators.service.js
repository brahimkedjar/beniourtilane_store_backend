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
exports.OperatorsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const schedule_utils_1 = require("./schedule.utils");
let OperatorsService = class OperatorsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
            include: { workingHours: true },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        return profile;
    }
    async updateProfile(userId, dto) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        return this.prisma.operatorProfile.update({
            where: { id: profile.id },
            data: {
                firstName: dto.firstName ?? profile.firstName,
                lastName: dto.lastName ?? profile.lastName,
                phone: dto.phone ?? profile.phone,
                phoneSecondary: dto.phoneSecondary !== undefined
                    ? dto.phoneSecondary || null
                    : profile.phoneSecondary,
                phoneNumbers: dto.phoneNumbers !== undefined
                    ? dto.phoneNumbers.filter((value) => value && value.trim().length > 0)
                    : profile.phoneNumbers,
                busType: dto.busType ?? profile.busType,
                seatCount: dto.seatCount ?? profile.seatCount,
                price: dto.price ?? profile.price,
                destinations: dto.destinations ?? profile.destinations,
                destinationsPricing: dto.destinationsPricing !== undefined
                    ? dto.destinationsPricing
                        .filter((item) => item.name && item.name.trim().length > 0)
                        .map((item) => ({
                        name: item.name.trim(),
                        price: item.price,
                    }))
                    : profile.destinationsPricing ?? undefined,
                plateNumber: dto.plateNumber !== undefined ? dto.plateNumber || null : profile.plateNumber,
            },
        });
    }
    async setActivationMode(userId, dto) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        if (dto.activationMode === client_1.ActivationMode.MANUAL &&
            dto.isActive === true &&
            !this.isProfileReady(profile)) {
            throw new common_1.BadRequestException('Complete bus profile before going active');
        }
        return this.prisma.operatorProfile.update({
            where: { id: profile.id },
            data: {
                activationMode: dto.activationMode,
                isActive: dto.activationMode === client_1.ActivationMode.MANUAL &&
                    typeof dto.isActive === 'boolean'
                    ? dto.isActive
                    : profile.isActive,
            },
        });
    }
    async setActive(userId, isActive) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        if (profile.activationMode !== client_1.ActivationMode.MANUAL) {
            throw new common_1.BadRequestException('Activation mode must be MANUAL');
        }
        if (isActive && !this.isProfileReady(profile)) {
            throw new common_1.BadRequestException('Complete bus profile before going active');
        }
        return this.prisma.operatorProfile.update({
            where: { id: profile.id },
            data: { isActive },
        });
    }
    async getWorkingHours(userId) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        const items = await this.prisma.workingHours.findMany({
            where: { operatorId: profile.id },
            orderBy: { dayOfWeek: 'asc' },
        });
        if (items.length === 0) {
            const defaults = Array.from({ length: 7 }).map((_, index) => ({
                operatorId: profile.id,
                dayOfWeek: index,
                startTime: '08:00',
                endTime: '18:00',
                enabled: false,
            }));
            await this.prisma.workingHours.createMany({ data: defaults });
            return this.prisma.workingHours.findMany({
                where: { operatorId: profile.id },
                orderBy: { dayOfWeek: 'asc' },
            });
        }
        return items;
    }
    async updateWorkingHours(userId, items) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        await this.prisma.$transaction(items.map((item) => this.prisma.workingHours.upsert({
            where: {
                operatorId_dayOfWeek: {
                    operatorId: profile.id,
                    dayOfWeek: item.dayOfWeek,
                },
            },
            create: {
                operatorId: profile.id,
                dayOfWeek: item.dayOfWeek,
                startTime: item.startTime,
                endTime: item.endTime,
                enabled: item.enabled,
            },
            update: {
                startTime: item.startTime,
                endTime: item.endTime,
                enabled: item.enabled,
            },
        })));
        return this.getWorkingHours(userId);
    }
    async updateLocationForUser(userId, dto) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        return this.updateLocation(profile.id, dto.latitude, dto.longitude);
    }
    async updateLocation(operatorId, latitude, longitude) {
        const now = new Date();
        await this.prisma.operatorProfile.update({
            where: { id: operatorId },
            data: {
                lastLat: latitude,
                lastLng: longitude,
                lastLocationAt: now,
            },
        });
        await this.prisma.$executeRaw `
      UPDATE "OperatorProfile"
      SET "lastLocation" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${operatorId}
    `;
        const locationId = (0, crypto_1.randomUUID)();
        await this.prisma.$executeRaw `
      INSERT INTO "OperatorLocation" ("id", "operatorId", "location", "latitude", "longitude", "recordedAt")
      VALUES (${locationId}, ${operatorId}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${latitude}, ${longitude}, ${now})
    `;
        return this.prisma.operatorProfile.findUnique({
            where: { id: operatorId },
        });
    }
    async listActiveBuses() {
        return this.listBuses({ onlyActive: true });
    }
    async getOperatorById(id) {
        return this.prisma.operatorProfile.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true, role: true } },
            },
        });
    }
    async listBuses(options) {
        const onlyActive = options?.onlyActive ?? false;
        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const operators = await this.prisma.operatorProfile.findMany({
            where: {
                ...(onlyActive
                    ? { isActive: true, lastLat: { not: null }, lastLng: { not: null } }
                    : {}),
            },
            include: {
                workingHours: {
                    where: { dayOfWeek },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        const confirmed = await this.prisma.booking.groupBy({
            by: ['operatorId'],
            where: { status: 'CONFIRMED' },
            _sum: { seatsRequested: true },
        });
        const confirmedMap = new Map(confirmed.map((item) => [item.operatorId, item._sum.seatsRequested || 0]));
        return operators.map((operator) => {
            const schedule = operator.workingHours[0];
            const workingToday = schedule ? schedule.enabled : false;
            const workingNow = schedule
                ? (0, schedule_utils_1.isScheduleActive)(currentMinutes, schedule)
                : false;
            const seatsTaken = confirmedMap.get(operator.id) || 0;
            const seatCount = operator.seatCount ?? 0;
            const seatsAvailable = Math.max(seatCount - seatsTaken, 0);
            return {
                id: operator.id,
                firstName: operator.firstName,
                lastName: operator.lastName,
                phone: operator.phone,
                phoneSecondary: operator.phoneSecondary,
                phoneNumbers: operator.phoneNumbers,
                busType: operator.busType,
                seatCount: operator.seatCount,
                plateNumber: operator.plateNumber,
                price: operator.price,
                destinations: operator.destinations,
                destinationsPricing: operator.destinationsPricing,
                isActive: operator.isActive,
                lastLat: operator.lastLat,
                lastLng: operator.lastLng,
                lastLocationAt: operator.lastLocationAt,
                workingToday,
                workingNow,
                todayStartTime: schedule?.startTime ?? null,
                todayEndTime: schedule?.endTime ?? null,
                seatsTaken,
                seatsAvailable,
            };
        });
    }
    isProfileReady(profile) {
        const hasPhone = (profile.phone && profile.phone.trim().length > 0) ||
            (profile.phoneNumbers && profile.phoneNumbers.length > 0);
        const hasPricing = profile.price !== null ||
            (Array.isArray(profile.destinationsPricing) &&
                profile.destinationsPricing.length > 0);
        return Boolean(profile.firstName &&
            profile.lastName &&
            hasPhone &&
            profile.busType &&
            profile.seatCount &&
            profile.seatCount > 0 &&
            hasPricing);
    }
    async getRatingSummary(userId) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator not found');
        }
        const aggregate = await this.prisma.rating.aggregate({
            where: { operatorId: profile.id },
            _avg: { score: true },
            _count: { score: true },
        });
        const grouped = await this.prisma.rating.groupBy({
            by: ['score'],
            where: { operatorId: profile.id },
            _count: { score: true },
        });
        const breakdown = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };
        for (const item of grouped) {
            breakdown[item.score] = item._count.score;
        }
        const recent = await this.prisma.rating.findMany({
            where: { operatorId: profile.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
        });
        return {
            averageScore: aggregate._avg.score ?? 0,
            totalRatings: aggregate._count.score ?? 0,
            breakdown,
            recent: recent.map((rating) => ({
                id: rating.id,
                bookingId: rating.bookingId,
                score: rating.score,
                comment: rating.comment,
                createdAt: rating.createdAt,
                passenger: rating.passenger,
            })),
        };
    }
};
exports.OperatorsService = OperatorsService;
exports.OperatorsService = OperatorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OperatorsService);
//# sourceMappingURL=operators.service.js.map