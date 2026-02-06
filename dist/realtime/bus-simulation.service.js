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
var BusSimulationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusSimulationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const operators_service_1 = require("../operators/operators.service");
const realtime_gateway_1 = require("./realtime.gateway");
let BusSimulationService = BusSimulationService_1 = class BusSimulationService {
    constructor(prisma, operatorsService, realtimeGateway, config) {
        this.prisma = prisma;
        this.operatorsService = operatorsService;
        this.realtimeGateway = realtimeGateway;
        this.logger = new common_1.Logger(BusSimulationService_1.name);
        this.state = new Map();
        this.lastTick = 0;
        this.enabled = config.get('SIMULATE_BUSES') === 'true';
        this.intervalMs = Number(config.get('SIMULATE_BUSES_INTERVAL_MS') ?? 4000);
        if (this.enabled) {
            this.logger.log(`Bus simulation enabled (interval: ${this.intervalMs}ms).`);
        }
    }
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
        const radius = 0.0025;
        const step = 0.18;
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
            const updated = await this.operatorsService.updateLocation(operator.id, nextLat, nextLng);
            if (updated) {
                this.realtimeGateway.emitBusLocation(updated);
            }
        }
    }
};
exports.BusSimulationService = BusSimulationService;
__decorate([
    (0, schedule_1.Interval)(1000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BusSimulationService.prototype, "tick", null);
exports.BusSimulationService = BusSimulationService = BusSimulationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        operators_service_1.OperatorsService,
        realtime_gateway_1.RealtimeGateway,
        config_1.ConfigService])
], BusSimulationService);
//# sourceMappingURL=bus-simulation.service.js.map