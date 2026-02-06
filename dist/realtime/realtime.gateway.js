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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const operators_service_1 = require("../operators/operators.service");
const socket_io_1 = require("socket.io");
const roles_enum_1 = require("../common/roles.enum");
const client_1 = require("@prisma/client");
let RealtimeGateway = class RealtimeGateway {
    constructor(jwtService, prisma, operatorsService) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.operatorsService = operatorsService;
    }
    async handleConnection(socket) {
        try {
            const token = this.extractToken(socket);
            if (!token) {
                throw new Error('Missing token');
            }
            const payload = await this.jwtService.verifyAsync(token);
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                include: { operatorProfile: true },
            });
            if (!user) {
                throw new Error('User not found');
            }
            socket.data.user = { id: user.id, role: user.role };
            socket.join(`user:${user.id}`);
            if (user.role === roles_enum_1.UserRole.OPERATOR && user.operatorProfile) {
                socket.data.operatorId = user.operatorProfile.id;
                socket.join(`operator:${user.operatorProfile.id}`);
                socket.join('operators');
            }
            if (user.role === roles_enum_1.UserRole.PASSENGER) {
                socket.join('passengers');
            }
        }
        catch (error) {
            socket.disconnect(true);
        }
    }
    handleDisconnect(_socket) {
    }
    handlePassengerSubscribe(socket) {
        const user = socket.data.user;
        if (user?.role === roles_enum_1.UserRole.PASSENGER) {
            socket.join('passengers');
        }
    }
    async handleOperatorLocation(socket, body) {
        const user = socket.data.user;
        if (!user || user.role !== roles_enum_1.UserRole.OPERATOR) {
            throw new websockets_1.WsException('Not allowed');
        }
        const operatorId = socket.data.operatorId;
        if (!operatorId) {
            throw new websockets_1.WsException('Operator profile missing');
        }
        if (typeof body?.latitude !== 'number' ||
            typeof body?.longitude !== 'number') {
            throw new websockets_1.WsException('Invalid location payload');
        }
        const updated = await this.operatorsService.updateLocation(operatorId, body.latitude, body.longitude);
        if (updated) {
            this.emitBusLocation(updated);
        }
    }
    async handlePassengerLocation(socket, body) {
        const user = socket.data.user;
        if (!user || user.role !== roles_enum_1.UserRole.PASSENGER) {
            throw new websockets_1.WsException('Not allowed');
        }
        if (typeof body?.bookingId !== 'string' ||
            typeof body?.latitude !== 'number' ||
            typeof body?.longitude !== 'number') {
            throw new websockets_1.WsException('Invalid location payload');
        }
        const booking = await this.prisma.booking.findUnique({
            where: { id: body.bookingId },
            select: { id: true, passengerId: true, status: true },
        });
        if (!booking || booking.passengerId !== user.id) {
            throw new websockets_1.WsException('Booking not found');
        }
        if (booking.status !== client_1.BookingStatus.PENDING &&
            booking.status !== client_1.BookingStatus.CONFIRMED) {
            return;
        }
        const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
                passengerLat: body.latitude,
                passengerLng: body.longitude,
                passengerLocationAt: new Date(),
            },
            include: {
                passenger: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                operator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        busType: true,
                        seatCount: true,
                        plateNumber: true,
                    },
                },
            },
        });
        await this.emitBookingUpdated(updated);
    }
    emitBusLocation(profile) {
        this.server.to('passengers').emit('bus:location', {
            id: profile.id,
            operatorId: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone,
            phoneSecondary: profile.phoneSecondary,
            phoneNumbers: profile.phoneNumbers ?? [],
            busType: profile.busType,
            seatCount: profile.seatCount,
            plateNumber: profile.plateNumber,
            price: profile.price,
            destinations: profile.destinations,
            destinationsPricing: profile.destinationsPricing ?? [],
            isActive: profile.isActive,
            latitude: profile.lastLat,
            longitude: profile.lastLng,
            updatedAt: profile.lastLocationAt,
        });
    }
    async handleRentalSubscribe(socket, body) {
        const user = socket.data.user;
        const conversationId = body?.conversationId;
        if (!user || !conversationId) {
            throw new websockets_1.WsException('Invalid conversation');
        }
        const conversation = await this.prisma.rentalConversation.findUnique({
            where: { id: conversationId },
            select: { id: true, passengerId: true, operatorId: true },
        });
        if (!conversation) {
            throw new websockets_1.WsException('Conversation not found');
        }
        const operatorId = socket.data.operatorId;
        const isPassenger = conversation.passengerId === user.id;
        const isOperator = operatorId && conversation.operatorId === operatorId;
        if (!isPassenger && !isOperator) {
            throw new websockets_1.WsException('Not allowed');
        }
        socket.join(`rental:conversation:${conversation.id}`);
    }
    emitRentalMessage(conversationId, payload) {
        this.server
            .to(`rental:conversation:${conversationId}`)
            .emit('rental:message', payload);
    }
    emitRentalRequest(payload) {
        this.server.to('operators').emit('rental:request', payload);
    }
    async emitBookingCreated(booking) {
        const payload = this.mapBooking(booking);
        this.server.to(`operator:${booking.operatorId}`).emit('booking:created', payload);
        this.server.to(`user:${booking.passengerId}`).emit('booking:created', payload);
    }
    async emitBookingUpdated(booking) {
        const payload = this.mapBooking(booking);
        this.server.to(`operator:${booking.operatorId}`).emit('booking:updated', payload);
        this.server.to(`user:${booking.passengerId}`).emit('booking:updated', payload);
    }
    mapBooking(booking) {
        return {
            id: booking.id,
            status: booking.status,
            seatsRequested: booking.seatsRequested,
            createdAt: booking.createdAt,
            expiresAt: booking.expiresAt,
            passengerLat: booking.passengerLat ?? null,
            passengerLng: booking.passengerLng ?? null,
            passengerLocationAt: booking.passengerLocationAt ?? null,
            passenger: booking.passenger
                ? {
                    id: booking.passenger.id,
                    email: booking.passenger.email,
                    firstName: booking.passenger.firstName,
                    lastName: booking.passenger.lastName,
                }
                : null,
            operator: booking.operator
                ? {
                    id: booking.operator.id,
                    firstName: booking.operator.firstName,
                    lastName: booking.operator.lastName,
                    phone: booking.operator.phone,
                    busType: booking.operator.busType,
                    seatCount: booking.operator.seatCount,
                    plateNumber: booking.operator.plateNumber,
                }
                : null,
        };
    }
    extractToken(socket) {
        const authToken = socket.handshake.auth?.token;
        if (authToken) {
            return authToken;
        }
        const header = socket.handshake.headers?.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) {
            return header.slice(7);
        }
        return null;
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('passenger:subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handlePassengerSubscribe", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('operator:location'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleOperatorLocation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('passenger:location'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handlePassengerLocation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rental:subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleRentalSubscribe", null);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/realtime',
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService,
        operators_service_1.OperatorsService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map