import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivationMode } from '@prisma/client';
import { isScheduleActive } from './schedule.utils';

@Injectable()
export class OperatorsScheduleService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoActivation() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const operators = await this.prisma.operatorProfile.findMany({
      where: { activationMode: ActivationMode.AUTO },
      include: {
        workingHours: {
          where: { dayOfWeek },
        },
      },
    });

    for (const operator of operators) {
      const schedule = operator.workingHours[0];
      const canActivate = this.isProfileReady(operator);
      const shouldBeActive =
        canActivate && schedule ? isScheduleActive(currentMinutes, schedule) : false;

      if (operator.isActive !== shouldBeActive) {
        await this.prisma.operatorProfile.update({
          where: { id: operator.id },
          data: { isActive: shouldBeActive },
        });
      }
    }
  }

  private isProfileReady(operator: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    busType: string | null;
    seatCount: number | null;
    price: number | null;
  }) {
    return Boolean(
      operator.firstName &&
        operator.lastName &&
        operator.phone &&
        operator.busType &&
        operator.seatCount &&
        operator.seatCount > 0 &&
        operator.price !== null,
    );
  }
}
