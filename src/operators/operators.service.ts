import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { ActivationMode } from '@prisma/client';
import { SetActivationDto } from './dto/set-activation.dto';
import { UpdateLocationDto } from './dto/location.dto';
import { randomUUID } from 'crypto';
import { isScheduleActive } from './schedule.utils';

@Injectable()
export class OperatorsService {
  constructor(private prisma: PrismaService) {}

  private busListCache = {
    all: { expiresAt: 0, data: null as any[] | null, inFlight: null as Promise<any[]> | null },
    active: { expiresAt: 0, data: null as any[] | null, inFlight: null as Promise<any[]> | null },
  };

  private get busListCacheMs() {
    const value = Number(process.env.BUS_LIST_CACHE_MS ?? 2000);
    return Number.isFinite(value) ? Math.max(value, 0) : 2000;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: { workingHours: true },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateOperatorDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: {
        firstName: dto.firstName ?? profile.firstName,
        lastName: dto.lastName ?? profile.lastName,
        phone: dto.phone ?? profile.phone,
        phoneSecondary:
          dto.phoneSecondary !== undefined
            ? dto.phoneSecondary || null
            : profile.phoneSecondary,
        phoneNumbers:
          dto.phoneNumbers !== undefined
            ? dto.phoneNumbers.filter(
                (value) => value && value.trim().length > 0,
              )
            : profile.phoneNumbers,
        busType: dto.busType ?? profile.busType,
        seatCount: dto.seatCount ?? profile.seatCount,
        price: dto.price ?? profile.price,
        destinations: dto.destinations ?? profile.destinations,
        destinationsPricing:
          dto.destinationsPricing !== undefined
            ? dto.destinationsPricing
                .filter((item) => item.name && item.name.trim().length > 0)
                .map((item) => ({
                  name: item.name.trim(),
                  price: item.price,
                }))
            : profile.destinationsPricing ?? undefined,
        plateNumber:
          dto.plateNumber !== undefined ? dto.plateNumber || null : profile.plateNumber,
      },
    });
  }

  async setActivationMode(userId: string, dto: SetActivationDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    if (
      dto.activationMode === ActivationMode.MANUAL &&
      dto.isActive === true &&
      !this.isProfileReady(profile)
    ) {
      throw new BadRequestException('Complete bus profile before going active');
    }

    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: {
        activationMode: dto.activationMode,
        isActive:
          dto.activationMode === ActivationMode.MANUAL &&
          typeof dto.isActive === 'boolean'
            ? dto.isActive
            : profile.isActive,
      },
    });
  }

  async setActive(userId: string, isActive: boolean) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    if (profile.activationMode !== ActivationMode.MANUAL) {
      throw new BadRequestException('Activation mode must be MANUAL');
    }
    if (isActive && !this.isProfileReady(profile)) {
      throw new BadRequestException('Complete bus profile before going active');
    }
    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: { isActive },
    });
  }

  async getWorkingHours(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
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

  async updateWorkingHours(userId: string, items: any[]) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.workingHours.upsert({
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
        }),
      ),
    );

    return this.getWorkingHours(userId);
  }

  async updateLocationForUser(userId: string, dto: UpdateLocationDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    return this.updateLocation(profile.id, dto.latitude, dto.longitude);
  }

  async updateLocation(operatorId: string, latitude: number, longitude: number) {
    const now = new Date();
    await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: {
        lastLat: latitude,
        lastLng: longitude,
        lastLocationAt: now,
      },
    });

    await this.prisma.$executeRaw`
      UPDATE "OperatorProfile"
      SET "lastLocation" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${operatorId}
    `;

    const locationId = randomUUID();
    await this.prisma.$executeRaw`
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

  async getOperatorById(id: string) {
    return this.prisma.operatorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });
  }

  async listBuses(options?: { onlyActive?: boolean }) {
    const onlyActive = options?.onlyActive ?? false;
    const cacheKey = onlyActive ? 'active' : 'all';
    const cacheMs = this.busListCacheMs;

    if (cacheMs > 0) {
      const cached = this.busListCache[cacheKey];
      const nowTs = Date.now();
      if (cached.data && cached.expiresAt > nowTs) {
        return cached.data;
      }
      if (cached.inFlight) {
        return cached.inFlight;
      }

      const promise = this.fetchBuses(onlyActive).then((data) => {
        cached.data = data;
        cached.expiresAt = nowTs + cacheMs;
        return data;
      });

      cached.inFlight = promise.finally(() => {
        cached.inFlight = null;
      });

      return cached.inFlight;
    }

    return this.fetchBuses(onlyActive);
  }

  private async fetchBuses(onlyActive: boolean) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const operators = await this.prisma.operatorProfile.findMany({
      where: {
        ...(onlyActive
          ? { isActive: true, lastLat: { not: null }, lastLng: { not: null } }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneSecondary: true,
        phoneNumbers: true,
        busType: true,
        seatCount: true,
        plateNumber: true,
        price: true,
        destinations: true,
        destinationsPricing: true,
        isActive: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        updatedAt: true,
        workingHours: {
          where: { dayOfWeek },
          select: { dayOfWeek: true, startTime: true, endTime: true, enabled: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const operatorIds = operators.map((operator) => operator.id);
    const confirmed =
      operatorIds.length === 0
        ? []
        : await this.prisma.booking.groupBy({
            by: ['operatorId'],
            where: { status: 'CONFIRMED', operatorId: { in: operatorIds } },
            _sum: { seatsRequested: true },
          });
    const confirmedMap = new Map(
      confirmed.map((item) => [item.operatorId, item._sum.seatsRequested || 0]),
    );

    return operators.map((operator) => {
      const schedule = operator.workingHours[0];
      const workingToday = schedule ? schedule.enabled : false;
      const workingNow = schedule
        ? isScheduleActive(currentMinutes, schedule)
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

  private isProfileReady(profile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    phoneNumbers?: string[];
    busType: string | null;
    seatCount: number | null;
    price: number | null;
    destinationsPricing?: any;
  }) {
    const hasPhone =
      (profile.phone && profile.phone.trim().length > 0) ||
      (profile.phoneNumbers && profile.phoneNumbers.length > 0);
    const hasPricing =
      profile.price !== null ||
      (Array.isArray(profile.destinationsPricing) &&
        profile.destinationsPricing.length > 0);
    return Boolean(
      profile.firstName &&
        profile.lastName &&
        hasPhone &&
        profile.busType &&
        profile.seatCount &&
        profile.seatCount > 0 &&
        hasPricing,
    );
  }

  async getRatingSummary(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator not found');
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

    const breakdown: Record<number, number> = {
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
}
