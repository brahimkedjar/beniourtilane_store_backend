import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';
import { OperatorsScheduleService } from './operators.schedule';

@Module({
  imports: [PrismaModule],
  controllers: [OperatorsController],
  providers: [OperatorsService, OperatorsScheduleService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
