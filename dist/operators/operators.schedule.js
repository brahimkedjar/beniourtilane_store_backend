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
exports.OperatorsScheduleService = void 0;
const schedule_1 = require("@nestjs/schedule");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const schedule_utils_1 = require("./schedule.utils");
let OperatorsScheduleService = class OperatorsScheduleService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleAutoActivation() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const operators = await this.prisma.operatorProfile.findMany({
            where: { activationMode: client_1.ActivationMode.AUTO },
            include: {
                workingHours: {
                    where: { dayOfWeek },
                },
            },
        });
        for (const operator of operators) {
            const schedule = operator.workingHours[0];
            const canActivate = this.isProfileReady(operator);
            const shouldBeActive = canActivate && schedule ? (0, schedule_utils_1.isScheduleActive)(currentMinutes, schedule) : false;
            if (operator.isActive !== shouldBeActive) {
                await this.prisma.operatorProfile.update({
                    where: { id: operator.id },
                    data: { isActive: shouldBeActive },
                });
            }
        }
    }
    isProfileReady(operator) {
        return Boolean(operator.firstName &&
            operator.lastName &&
            operator.phone &&
            operator.busType &&
            operator.seatCount &&
            operator.seatCount > 0 &&
            operator.price !== null);
    }
};
exports.OperatorsScheduleService = OperatorsScheduleService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OperatorsScheduleService.prototype, "handleAutoActivation", null);
exports.OperatorsScheduleService = OperatorsScheduleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OperatorsScheduleService);
//# sourceMappingURL=operators.schedule.js.map