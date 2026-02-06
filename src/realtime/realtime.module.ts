import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperatorsModule } from '../operators/operators.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { BusSimulationService } from './bus-simulation.service';

@Module({
  imports: [PrismaModule, OperatorsModule, AuthModule],
  providers: [RealtimeGateway, BusSimulationService],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
