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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const roles_enum_1 = require("../common/roles.enum");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async registerPassenger(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (existing) {
            throw new common_1.BadRequestException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
                firstName: dto.firstName ?? null,
                lastName: dto.lastName ?? null,
                passwordHash,
                role: roles_enum_1.UserRole.PASSENGER,
            },
        });
        return this.buildAuthResponse(user.id);
    }
    async registerOperator(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (existing) {
            throw new common_1.BadRequestException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: dto.email.toLowerCase(),
                    passwordHash,
                    role: roles_enum_1.UserRole.OPERATOR,
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
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const match = await bcrypt.compare(dto.password, user.passwordHash);
        if (!match) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.buildAuthResponse(user.id);
    }
    async getMe(userId) {
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
    async buildAuthResponse(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { operatorProfile: true },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map