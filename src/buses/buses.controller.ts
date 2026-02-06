import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OperatorsService } from '../operators/operators.service';

@ApiTags('buses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buses')
export class BusesController {
  constructor(private operatorsService: OperatorsService) {}

  @Get()
  listAll() {
    return this.operatorsService.listBuses();
  }

  @Get('active')
  listActive() {
    return this.operatorsService.listActiveBuses();
  }

  @Get(':id')
  getBus(@Param('id') id: string) {
    return this.operatorsService.getOperatorById(id);
  }
}
