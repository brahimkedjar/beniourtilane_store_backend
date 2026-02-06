import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorsService } from '../operators/operators.service';
import { RealtimeGateway } from './realtime.gateway';

type SimState = {
  baseLat: number;
  baseLng: number;
  angle: number;
};

@Injectable()
export class BusSimulationService {
  private readonly logger = new Logger(BusSimulationService.name);
  private readonly state = new Map<string, SimState>();
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private lastTick = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly operatorsService: OperatorsService,
    private readonly realtimeGateway: RealtimeGateway,
    config: ConfigService,
  ) {
    this.enabled = config.get('SIMULATE_BUSES') === 'true';
    this.intervalMs = Number(config.get('SIMULATE_BUSES_INTERVAL_MS') ?? 4000);
    if (this.enabled) {
      this.logger.log(
        `Bus simulation enabled (interval: ${this.intervalMs}ms).`,
      );
    }
  }

  @Interval(1000)
  async tick() {
    if (!this.enabled) {
      return;
    }
    const now = Date.now();
    if (now - this.lastTick < this.intervalMs) {
      return;
    }
    this.lastTick = now;

    const operators = await this.prisma.operatorProfile.findMany({
      where: { isActive: true, lastLat: { not: null }, lastLng: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneSecondary: true,
        busType: true,
        seatCount: true,
        plateNumber: true,
        price: true,
        destinations: true,
        isActive: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
      },
    });

    if (operators.length === 0) {
      return;
    }

    const radius = 0.0025; // ~250m
    const step = 0.18; // radians per tick

    for (const operator of operators) {
      if (operator.lastLat == null || operator.lastLng == null) {
        continue;
      }
      const existing = this.state.get(operator.id);
      const baseLat = existing?.baseLat ?? operator.lastLat;
      const baseLng = existing?.baseLng ?? operator.lastLng;
      const nextAngle = (existing?.angle ?? Math.random() * Math.PI * 2) + step;

      const nextLat = baseLat + radius * Math.cos(nextAngle);
      const nextLng = baseLng + radius * Math.sin(nextAngle);

      this.state.set(operator.id, {
        baseLat,
        baseLng,
        angle: nextAngle,
      });

      const updated = await this.operatorsService.updateLocation(
        operator.id,
        nextLat,
        nextLng,
      );

      if (updated) {
        this.realtimeGateway.emitBusLocation(updated);
      }
    }
  }
}
