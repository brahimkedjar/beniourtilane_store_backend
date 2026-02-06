import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OperatorsService } from './operators.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../common/roles.enum';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { SetActivationDto } from './dto/set-activation.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateWorkingHoursDto } from './dto/working-hours.dto';
import { UpdateLocationDto } from './dto/location.dto';

@ApiTags('operator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR)
@Controller('operator')
export class OperatorsController {
  constructor(private operatorsService: OperatorsService) {}

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.operatorsService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.updateProfile(user.id, dto);
  }

  @Patch('activation-mode')
  setActivationMode(
    @CurrentUser() user: any,
    @Body() dto: SetActivationDto,
  ) {
    return this.operatorsService.setActivationMode(user.id, dto);
  }

  @Patch('active')
  setActive(@CurrentUser() user: any, @Body() dto: SetActiveDto) {
    return this.operatorsService.setActive(user.id, dto.isActive);
  }

  @Get('working-hours')
  getWorkingHours(@CurrentUser() user: any) {
    return this.operatorsService.getWorkingHours(user.id);
  }

  @Patch('working-hours')
  updateWorkingHours(
    @CurrentUser() user: any,
    @Body() dto: UpdateWorkingHoursDto,
  ) {
    return this.operatorsService.updateWorkingHours(user.id, dto.items);
  }

  @Post('location')
  updateLocation(@CurrentUser() user: any, @Body() dto: UpdateLocationDto) {
    return this.operatorsService.updateLocationForUser(user.id, dto);
  }

  @Get('ratings/summary')
  getRatingsSummary(@CurrentUser() user: any) {
    return this.operatorsService.getRatingSummary(user.id);
  }
}
