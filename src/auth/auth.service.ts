import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPassengerDto } from './dto/register-passenger.dto';
import { RegisterOperatorDto } from './dto/register-operator.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../common/roles.enum';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerPassenger(dto: RegisterPassengerDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        passwordHash,
        role: UserRole.PASSENGER,
      },
    });

    return this.buildAuthResponse(user.id);
  }

  async registerOperator(dto: RegisterOperatorDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          role: UserRole.OPERATOR,
        },
      });

      const operator = await tx.operatorProfile.create({
        data: {
          userId: user.id,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
          phone: dto.phone ?? null,
          phoneSecondary: dto.phoneSecondary ?? null,
          busType: dto.busType ?? null,
          seatCount: dto.seatCount ?? null,
          price: dto.price ?? null,
          destinations: dto.destinations ?? [],
          plateNumber: dto.plateNumber || null,
        },
      });

      const defaults = Array.from({ length: 7 }).map((_, index) => ({
        operatorId: operator.id,
        dayOfWeek: index,
        startTime: '08:00',
        endTime: '18:00',
        enabled: false,
      }));
      await tx.workingHours.createMany({ data: defaults });
      return user;
    });

    return this.buildAuthResponse(result.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user.id);
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        operatorProfile: true,
      },
    });
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { operatorProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const payload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        operatorProfile: user.operatorProfile,
      },
    };
  }
}
