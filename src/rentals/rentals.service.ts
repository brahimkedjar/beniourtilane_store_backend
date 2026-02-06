import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RentalListingStatus,
  RentalRequestStatus,
  RentalVehicleKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UserRole } from '../common/roles.enum';

interface CurrentUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class RentalsService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async listListings(
    user: CurrentUser,
    query: { status?: string; kind?: string; mine?: string },
  ) {
    const status = this.parseListingStatus(query.status);
    const kind = this.parseVehicleKind(query.kind);
    const mine = query.mine === 'true';

    const where: any = {};
    if (kind) {
      where.vehicleKind = kind;
    }

    if (mine) {
      if (user.role !== UserRole.OPERATOR) {
        throw new ForbiddenException('Only operators can view their listings');
      }
      const operator = await this.getOperatorProfile(user.id);
      where.operatorId = operator.id;
      if (status) {
        where.status = status;
      }
    } else {
      where.status = status ?? RentalListingStatus.AVAILABLE;
    }

    const listings = await this.prisma.rentalListing.findMany({
      where,
      include: { operator: true },
      orderBy: { createdAt: 'desc' },
    });

    return listings.map((listing) => this.mapListing(listing));
  }

  async createListing(userId: string, dto: any) {
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

  async updateListing(userId: string, listingId: string, dto: any) {
    const operator = await this.getOperatorProfile(userId);
    const listing = await this.prisma.rentalListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.operatorId !== operator.id) {
      throw new ForbiddenException('Not allowed');
    }
    if (listing.status === RentalListingStatus.RESERVED) {
      throw new BadRequestException('Listing is reserved');
    }
    if (dto.status === RentalListingStatus.RESERVED) {
      throw new BadRequestException('Listing cannot be reserved manually');
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

  async setListingStatus(userId: string, listingId: string, status: string) {
    const operator = await this.getOperatorProfile(userId);
    const listing = await this.prisma.rentalListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.operatorId !== operator.id) {
      throw new ForbiddenException('Not allowed');
    }
    if (listing.status === RentalListingStatus.RESERVED) {
      throw new BadRequestException('Listing is reserved');
    }
    const nextStatus = this.parseListingStatus(status);
    if (!nextStatus || nextStatus === RentalListingStatus.RESERVED) {
      throw new BadRequestException('Invalid status');
    }
    const updated = await this.prisma.rentalListing.update({
      where: { id: listingId },
      data: { status: nextStatus },
      include: { operator: true },
    });
    return this.mapListing(updated);
  }

  async listRequestsForOperator(userId: string, status?: string) {
    const operator = await this.getOperatorProfile(userId);
    const requestStatus = this.parseRequestStatus(status) ??
      RentalRequestStatus.PENDING;

    const requests = await this.prisma.rentalRequest.findMany({
      where: { status: requestStatus },
      include: { passenger: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => this.mapRequest(request));
  }

  async listRequestsForPassenger(userId: string) {
    const requests = await this.prisma.rentalRequest.findMany({
      where: { passengerId: userId },
      include: { passenger: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => this.mapRequest(request));
  }

  async createRequest(userId: string, dto: any) {
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

    this.realtimeGateway.emitRentalRequest(
      this.mapRequest(request),
    );

    return this.mapRequest(request);
  }

  async confirmRequest(userId: string, requestId: string, listingId: string) {
    const operator = await this.getOperatorProfile(userId);
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== RentalRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    const listing = await this.prisma.rentalListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.operatorId !== operator.id) {
      throw new ForbiddenException('Not allowed');
    }
    if (listing.status !== RentalListingStatus.AVAILABLE) {
      throw new BadRequestException('Listing is not available');
    }
    if (listing.vehicleKind !== request.vehicleKind) {
      throw new BadRequestException('Listing type does not match request');
    }

    if (!this.isWithinAvailability(listing, request)) {
      throw new BadRequestException('Request dates are out of availability');
    }

    await this.prisma.$transaction(async (tx) => {
      const freshListing = await tx.rentalListing.findUnique({
        where: { id: listingId },
      });
      if (!freshListing || freshListing.status !== RentalListingStatus.AVAILABLE) {
        throw new BadRequestException('Listing is no longer available');
      }

      await tx.rentalListing.update({
        where: { id: listingId },
        data: {
          status: RentalListingStatus.RESERVED,
          reservedFrom: request.startDate,
          reservedTo: request.endDate,
          reservedRequestId: request.id,
          reservedPassengerId: request.passengerId,
        },
      });

      await tx.rentalRequest.update({
        where: { id: requestId },
        data: { status: RentalRequestStatus.CONFIRMED },
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

  async rejectRequest(userId: string, requestId: string) {
    await this.getOperatorProfile(userId);
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== RentalRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }
    const updated = await this.prisma.rentalRequest.update({
      where: { id: requestId },
      data: { status: RentalRequestStatus.REJECTED },
      include: { passenger: true },
    });

    return this.mapRequest(updated);
  }

  async cancelRequest(userId: string, requestId: string) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.passengerId !== userId) {
      throw new ForbiddenException('Not allowed');
    }

    await this.prisma.$transaction(async (tx) => {
      const listing = await tx.rentalListing.findFirst({
        where: { reservedRequestId: request.id },
      });
      if (listing) {
        await tx.rentalListing.update({
          where: { id: listing.id },
          data: {
            status: RentalListingStatus.AVAILABLE,
            reservedFrom: null,
            reservedTo: null,
            reservedRequestId: null,
            reservedPassengerId: null,
          },
        });
      }

      await tx.rentalRequest.update({
        where: { id: requestId },
        data: { status: RentalRequestStatus.CANCELED },
      });
    });

    const updated = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
      include: { passenger: true },
    });
    return updated ? this.mapRequest(updated) : null;
  }

  async listConversations(user: CurrentUser) {
    const where: any = {};
    if (user.role === UserRole.OPERATOR) {
      const operator = await this.getOperatorProfile(user.id);
      where.operatorId = operator.id;
    } else {
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

  async createConversation(user: CurrentUser, dto: any) {
    const listingId = dto.listingId as string | undefined;
    const requestId = dto.requestId as string | undefined;

    if ((!listingId && !requestId) || (listingId && requestId)) {
      throw new BadRequestException('Listing or request must be provided');
    }

    if (listingId) {
      if (user.role !== UserRole.PASSENGER) {
        throw new ForbiddenException('Only passengers can start this chat');
      }
      const listing = await this.prisma.rentalListing.findUnique({
        where: { id: listingId },
      });
      if (!listing) {
        throw new NotFoundException('Listing not found');
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

    if (user.role !== UserRole.OPERATOR) {
      throw new ForbiddenException('Only operators can start this chat');
    }
    const operator = await this.getOperatorProfile(user.id);
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
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

  async getMessages(user: CurrentUser, conversationId: string) {
    const conversation = await this.getConversationForUser(user, conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return this.prisma.rentalMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(user: CurrentUser, conversationId: string, message: string) {
    const conversation = await this.getConversationForUser(user, conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
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

  private async getOperatorProfile(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }
    return profile;
  }

  private parseVehicleKind(value?: string) {
    if (!value) return null;
    const upper = value.toUpperCase();
    if (upper === 'BUS') return RentalVehicleKind.BUS;
    if (upper === 'CAR') return RentalVehicleKind.CAR;
    return null;
  }

  private parseListingStatus(value?: string) {
    if (!value) return null;
    const upper = value.toUpperCase();
    if (upper === 'AVAILABLE') return RentalListingStatus.AVAILABLE;
    if (upper === 'RESERVED') return RentalListingStatus.RESERVED;
    if (upper === 'INACTIVE') return RentalListingStatus.INACTIVE;
    return null;
  }

  private parseRequestStatus(value?: string) {
    if (!value) return null;
    const upper = value.toUpperCase();
    if (upper === 'PENDING') return RentalRequestStatus.PENDING;
    if (upper === 'CONFIRMED') return RentalRequestStatus.CONFIRMED;
    if (upper === 'REJECTED') return RentalRequestStatus.REJECTED;
    if (upper === 'CANCELED') return RentalRequestStatus.CANCELED;
    if (upper === 'EXPIRED') return RentalRequestStatus.EXPIRED;
    return null;
  }

  private parseDate(value?: string, required?: false): Date | null;
  private parseDate(value: string | undefined, required: true): Date;
  private parseDate(value?: string, required = false): Date | null {
    if (!value) {
      if (required) {
        throw new BadRequestException('Date is required');
      }
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return date;
  }

  private assertDateRange(
    start: Date | null,
    end: Date | null,
    required = false,
  ) {
    if (required && (!start || !end)) {
      throw new BadRequestException('Start and end dates are required');
    }
    if (start && end && start >= end) {
      throw new BadRequestException('Start date must be before end date');
    }
  }

  private isWithinAvailability(listing: any, request: any) {
    if (listing.availableFrom && request.startDate < listing.availableFrom) {
      return false;
    }
    if (listing.availableTo && request.endDate > listing.availableTo) {
      return false;
    }
    return true;
  }

  private async getConversationForUser(user: CurrentUser, conversationId: string) {
    const conversation = await this.prisma.rentalConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      return null;
    }
    if (user.role === UserRole.PASSENGER) {
      return conversation.passengerId === user.id ? conversation : null;
    }
    const operator = await this.getOperatorProfile(user.id);
    return conversation.operatorId === operator.id ? conversation : null;
  }

  private mapListing(listing: any) {
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

  private mapRequest(request: any) {
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

  private mapConversation(conversation: any) {
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
}

