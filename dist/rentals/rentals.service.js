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
exports.RentalsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const roles_enum_1 = require("../common/roles.enum");
let RentalsService = class RentalsService {
    constructor(prisma, realtimeGateway) {
        this.prisma = prisma;
        this.realtimeGateway = realtimeGateway;
    }
    async listListings(user, query) {
        const status = this.parseListingStatus(query.status);
        const kind = this.parseVehicleKind(query.kind);
        const mine = query.mine === 'true';
        const where = {};
        if (kind) {
            where.vehicleKind = kind;
        }
        if (mine) {
            if (user.role !== roles_enum_1.UserRole.OPERATOR) {
                throw new common_1.ForbiddenException('Only operators can view their listings');
            }
            const operator = await this.getOperatorProfile(user.id);
            where.operatorId = operator.id;
            if (status) {
                where.status = status;
            }
        }
        else {
            where.status = status ?? client_1.RentalListingStatus.AVAILABLE;
        }
        const listings = await this.prisma.rentalListing.findMany({
            where,
            include: { operator: true },
            orderBy: { createdAt: 'desc' },
        });
        return listings.map((listing) => this.mapListing(listing));
    }
    async createListing(userId, dto) {
        const operator = await this.getOperatorProfile(userId);
        const availableFrom = this.parseDate(dto.availableFrom);
        const availableTo = this.parseDate(dto.availableTo);
        this.assertDateRange(availableFrom, availableTo);
        const listing = await this.prisma.rentalListing.create({
            data: {
                operatorId: operator.id,
                vehicleKind: dto.vehicleKind,
                title: dto.title,
                description: dto.description,
                pricePerDay: dto.pricePerDay,
                seatCount: dto.seatCount,
                plateNumber: dto.plateNumber,
                location: dto.location,
                availableFrom,
                availableTo,
            },
            include: { operator: true },
        });
        return this.mapListing(listing);
    }
    async updateListing(userId, listingId, dto) {
        const operator = await this.getOperatorProfile(userId);
        const listing = await this.prisma.rentalListing.findUnique({
            where: { id: listingId },
        });
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.operatorId !== operator.id) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (listing.status === client_1.RentalListingStatus.RESERVED) {
            throw new common_1.BadRequestException('Listing is reserved');
        }
        if (dto.status === client_1.RentalListingStatus.RESERVED) {
            throw new common_1.BadRequestException('Listing cannot be reserved manually');
        }
        const availableFrom = this.parseDate(dto.availableFrom);
        const availableTo = this.parseDate(dto.availableTo);
        this.assertDateRange(availableFrom, availableTo);
        const updated = await this.prisma.rentalListing.update({
            where: { id: listingId },
            data: {
                vehicleKind: dto.vehicleKind ?? listing.vehicleKind,
                title: dto.title ?? listing.title,
                description: dto.description ?? listing.description,
                pricePerDay: dto.pricePerDay ?? listing.pricePerDay,
                seatCount: dto.seatCount ?? listing.seatCount,
                plateNumber: dto.plateNumber ?? listing.plateNumber,
                location: dto.location ?? listing.location,
                availableFrom: dto.availableFrom ? availableFrom : listing.availableFrom,
                availableTo: dto.availableTo ? availableTo : listing.availableTo,
                status: dto.status ?? listing.status,
            },
            include: { operator: true },
        });
        return this.mapListing(updated);
    }
    async setListingStatus(userId, listingId, status) {
        const operator = await this.getOperatorProfile(userId);
        const listing = await this.prisma.rentalListing.findUnique({
            where: { id: listingId },
        });
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.operatorId !== operator.id) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (listing.status === client_1.RentalListingStatus.RESERVED) {
            throw new common_1.BadRequestException('Listing is reserved');
        }
        const nextStatus = this.parseListingStatus(status);
        if (!nextStatus || nextStatus === client_1.RentalListingStatus.RESERVED) {
            throw new common_1.BadRequestException('Invalid status');
        }
        const updated = await this.prisma.rentalListing.update({
            where: { id: listingId },
            data: { status: nextStatus },
            include: { operator: true },
        });
        return this.mapListing(updated);
    }
    async listRequestsForOperator(userId, status) {
        const operator = await this.getOperatorProfile(userId);
        const requestStatus = this.parseRequestStatus(status) ??
            client_1.RentalRequestStatus.PENDING;
        const requests = await this.prisma.rentalRequest.findMany({
            where: { status: requestStatus },
            include: { passenger: true },
            orderBy: { createdAt: 'desc' },
        });
        return requests.map((request) => this.mapRequest(request));
    }
    async listRequestsForPassenger(userId) {
        const requests = await this.prisma.rentalRequest.findMany({
            where: { passengerId: userId },
            include: { passenger: true },
            orderBy: { createdAt: 'desc' },
        });
        return requests.map((request) => this.mapRequest(request));
    }
    async createRequest(userId, dto) {
        const startDate = this.parseDate(dto.startDate, true);
        const endDate = this.parseDate(dto.endDate, true);
        this.assertDateRange(startDate, endDate, true);
        const request = await this.prisma.rentalRequest.create({
            data: {
                passengerId: userId,
                vehicleKind: dto.vehicleKind,
                startDate,
                endDate,
                seatCount: dto.seatCount,
                budget: dto.budget,
                notes: dto.notes,
            },
            include: { passenger: true },
        });
        this.realtimeGateway.emitRentalRequest(this.mapRequest(request));
        return this.mapRequest(request);
    }
    async confirmRequest(userId, requestId, listingId) {
        const operator = await this.getOperatorProfile(userId);
        const request = await this.prisma.rentalRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) {
            throw new common_1.NotFoundException('Request not found');
        }
        if (request.status !== client_1.RentalRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Request is not pending');
        }
        const listing = await this.prisma.rentalListing.findUnique({
            where: { id: listingId },
        });
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.operatorId !== operator.id) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        if (listing.status !== client_1.RentalListingStatus.AVAILABLE) {
            throw new common_1.BadRequestException('Listing is not available');
        }
        if (listing.vehicleKind !== request.vehicleKind) {
            throw new common_1.BadRequestException('Listing type does not match request');
        }
        if (!this.isWithinAvailability(listing, request)) {
            throw new common_1.BadRequestException('Request dates are out of availability');
        }
        await this.prisma.$transaction(async (tx) => {
            const freshListing = await tx.rentalListing.findUnique({
                where: { id: listingId },
            });
            if (!freshListing || freshListing.status !== client_1.RentalListingStatus.AVAILABLE) {
                throw new common_1.BadRequestException('Listing is no longer available');
            }
            await tx.rentalListing.update({
                where: { id: listingId },
                data: {
                    status: client_1.RentalListingStatus.RESERVED,
                    reservedFrom: request.startDate,
                    reservedTo: request.endDate,
                    reservedRequestId: request.id,
                    reservedPassengerId: request.passengerId,
                },
            });
            await tx.rentalRequest.update({
                where: { id: requestId },
                data: { status: client_1.RentalRequestStatus.CONFIRMED },
            });
        });
        const updatedListing = await this.prisma.rentalListing.findUnique({
            where: { id: listingId },
            include: { operator: true },
        });
        return {
            listing: updatedListing ? this.mapListing(updatedListing) : null,
        };
    }
    async rejectRequest(userId, requestId) {
        await this.getOperatorProfile(userId);
        const request = await this.prisma.rentalRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) {
            throw new common_1.NotFoundException('Request not found');
        }
        if (request.status !== client_1.RentalRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Request is not pending');
        }
        const updated = await this.prisma.rentalRequest.update({
            where: { id: requestId },
            data: { status: client_1.RentalRequestStatus.REJECTED },
            include: { passenger: true },
        });
        return this.mapRequest(updated);
    }
    async cancelRequest(userId, requestId) {
        const request = await this.prisma.rentalRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) {
            throw new common_1.NotFoundException('Request not found');
        }
        if (request.passengerId !== userId) {
            throw new common_1.ForbiddenException('Not allowed');
        }
        await this.prisma.$transaction(async (tx) => {
            const listing = await tx.rentalListing.findFirst({
                where: { reservedRequestId: request.id },
            });
            if (listing) {
                await tx.rentalListing.update({
                    where: { id: listing.id },
                    data: {
                        status: client_1.RentalListingStatus.AVAILABLE,
                        reservedFrom: null,
                        reservedTo: null,
                        reservedRequestId: null,
                        reservedPassengerId: null,
                    },
                });
            }
            await tx.rentalRequest.update({
                where: { id: requestId },
                data: { status: client_1.RentalRequestStatus.CANCELED },
            });
        });
        const updated = await this.prisma.rentalRequest.findUnique({
            where: { id: requestId },
            include: { passenger: true },
        });
        return updated ? this.mapRequest(updated) : null;
    }
    async listConversations(user) {
        const where = {};
        if (user.role === roles_enum_1.UserRole.OPERATOR) {
            const operator = await this.getOperatorProfile(user.id);
            where.operatorId = operator.id;
        }
        else {
            where.passengerId = user.id;
        }
        const conversations = await this.prisma.rentalConversation.findMany({
            where,
            include: {
                listing: true,
                request: true,
                passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
                operator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        phoneSecondary: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return conversations.map((conversation) => this.mapConversation(conversation));
    }
    async createConversation(user, dto) {
        const listingId = dto.listingId;
        const requestId = dto.requestId;
        if ((!listingId && !requestId) || (listingId && requestId)) {
            throw new common_1.BadRequestException('Listing or request must be provided');
        }
        if (listingId) {
            if (user.role !== roles_enum_1.UserRole.PASSENGER) {
                throw new common_1.ForbiddenException('Only passengers can start this chat');
            }
            const listing = await this.prisma.rentalListing.findUnique({
                where: { id: listingId },
            });
            if (!listing) {
                throw new common_1.NotFoundException('Listing not found');
            }
            const conversation = await this.prisma.rentalConversation.upsert({
                where: {
                    listingId_passengerId: {
                        listingId: listing.id,
                        passengerId: user.id,
                    },
                },
                update: {},
                create: {
                    listingId: listing.id,
                    passengerId: user.id,
                    operatorId: listing.operatorId,
                },
                include: {
                    listing: true,
                    request: true,
                    passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
                    operator: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                            phoneSecondary: true,
                        },
                    },
                    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
            });
            return this.mapConversation(conversation);
        }
        if (user.role !== roles_enum_1.UserRole.OPERATOR) {
            throw new common_1.ForbiddenException('Only operators can start this chat');
        }
        const operator = await this.getOperatorProfile(user.id);
        const request = await this.prisma.rentalRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) {
            throw new common_1.NotFoundException('Request not found');
        }
        const conversation = await this.prisma.rentalConversation.upsert({
            where: {
                requestId_operatorId: {
                    requestId: request.id,
                    operatorId: operator.id,
                },
            },
            update: {},
            create: {
                requestId: request.id,
                passengerId: request.passengerId,
                operatorId: operator.id,
            },
            include: {
                listing: true,
                request: true,
                passenger: { select: { id: true, email: true, firstName: true, lastName: true } },
                operator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        phoneSecondary: true,
                    },
                },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        return this.mapConversation(conversation);
    }
    async getMessages(user, conversationId) {
        const conversation = await this.getConversationForUser(user, conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        return this.prisma.rentalMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'asc' },
        });
    }
    async sendMessage(user, conversationId, message) {
        const conversation = await this.getConversationForUser(user, conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const messageRecord = await this.prisma.rentalMessage.create({
            data: {
                conversationId: conversation.id,
                senderId: user.id,
                body: message,
            },
        });
        await this.prisma.rentalConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
        });
        this.realtimeGateway.emitRentalMessage(conversation.id, messageRecord);
        return messageRecord;
    }
    async getOperatorProfile(userId) {
        const profile = await this.prisma.operatorProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Operator profile not found');
        }
        return profile;
    }
    parseVehicleKind(value) {
        if (!value)
            return null;
        const upper = value.toUpperCase();
        if (upper === 'BUS')
            return client_1.RentalVehicleKind.BUS;
        if (upper === 'CAR')
            return client_1.RentalVehicleKind.CAR;
        return null;
    }
    parseListingStatus(value) {
        if (!value)
            return null;
        const upper = value.toUpperCase();
        if (upper === 'AVAILABLE')
            return client_1.RentalListingStatus.AVAILABLE;
        if (upper === 'RESERVED')
            return client_1.RentalListingStatus.RESERVED;
        if (upper === 'INACTIVE')
            return client_1.RentalListingStatus.INACTIVE;
        return null;
    }
    parseRequestStatus(value) {
        if (!value)
            return null;
        const upper = value.toUpperCase();
        if (upper === 'PENDING')
            return client_1.RentalRequestStatus.PENDING;
        if (upper === 'CONFIRMED')
            return client_1.RentalRequestStatus.CONFIRMED;
        if (upper === 'REJECTED')
            return client_1.RentalRequestStatus.REJECTED;
        if (upper === 'CANCELED')
            return client_1.RentalRequestStatus.CANCELED;
        if (upper === 'EXPIRED')
            return client_1.RentalRequestStatus.EXPIRED;
        return null;
    }
    parseDate(value, required = false) {
        if (!value) {
            if (required) {
                throw new common_1.BadRequestException('Date is required');
            }
            return null;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new common_1.BadRequestException('Invalid date');
        }
        return date;
    }
    assertDateRange(start, end, required = false) {
        if (required && (!start || !end)) {
            throw new common_1.BadRequestException('Start and end dates are required');
        }
        if (start && end && start >= end) {
            throw new common_1.BadRequestException('Start date must be before end date');
        }
    }
    isWithinAvailability(listing, request) {
        if (listing.availableFrom && request.startDate < listing.availableFrom) {
            return false;
        }
        if (listing.availableTo && request.endDate > listing.availableTo) {
            return false;
        }
        return true;
    }
    async getConversationForUser(user, conversationId) {
        const conversation = await this.prisma.rentalConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) {
            return null;
        }
        if (user.role === roles_enum_1.UserRole.PASSENGER) {
            return conversation.passengerId === user.id ? conversation : null;
        }
        const operator = await this.getOperatorProfile(user.id);
        return conversation.operatorId === operator.id ? conversation : null;
    }
    mapListing(listing) {
        return {
            id: listing.id,
            operatorId: listing.operatorId,
            vehicleKind: listing.vehicleKind,
            title: listing.title,
            description: listing.description,
            pricePerDay: listing.pricePerDay,
            seatCount: listing.seatCount,
            plateNumber: listing.plateNumber,
            location: listing.location,
            availableFrom: listing.availableFrom,
            availableTo: listing.availableTo,
            status: listing.status,
            reservedFrom: listing.reservedFrom,
            reservedTo: listing.reservedTo,
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
            operator: listing.operator
                ? {
                    id: listing.operator.id,
                    firstName: listing.operator.firstName,
                    lastName: listing.operator.lastName,
                    phone: listing.operator.phone,
                    phoneSecondary: listing.operator.phoneSecondary,
                }
                : null,
        };
    }
    mapRequest(request) {
        return {
            id: request.id,
            passengerId: request.passengerId,
            vehicleKind: request.vehicleKind,
            startDate: request.startDate,
            endDate: request.endDate,
            seatCount: request.seatCount,
            budget: request.budget,
            notes: request.notes,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            passenger: request.passenger
                ? {
                    id: request.passenger.id,
                    email: request.passenger.email,
                    firstName: request.passenger.firstName,
                    lastName: request.passenger.lastName,
                }
                : null,
        };
    }
    mapConversation(conversation) {
        const lastMessage = conversation.messages?.[0];
        return {
            id: conversation.id,
            listingId: conversation.listingId,
            requestId: conversation.requestId,
            updatedAt: conversation.updatedAt,
            listing: conversation.listing,
            request: conversation.request,
            passenger: conversation.passenger,
            operator: conversation.operator,
            lastMessage: lastMessage
                ? {
                    id: lastMessage.id,
                    senderId: lastMessage.senderId,
                    body: lastMessage.body,
                    createdAt: lastMessage.createdAt,
                }
                : null,
        };
    }
};
exports.RentalsService = RentalsService;
exports.RentalsService = RentalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_gateway_1.RealtimeGateway])
], RentalsService);
//# sourceMappingURL=rentals.service.js.map