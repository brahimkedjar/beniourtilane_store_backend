import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperatorsModule } from '../operators/operators.module';
import { BusesController } from './buses.controller';

@Module({
  imports: [PrismaModule, OperatorsModule],
  controllers: [BusesController],
})
export class BusesModule {}
