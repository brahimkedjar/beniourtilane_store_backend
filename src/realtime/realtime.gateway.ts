import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorsService } from '../operators/operators.service';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../common/roles.enum';
import { BookingStatus } from '@prisma/client';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*' },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private operatorsService: OperatorsService,
  ) {}

  async handleConnection(socket: Socket) {
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

      if (user.role === UserRole.OPERATOR && user.operatorProfile) {
        socket.data.operatorId = user.operatorProfile.id;
        socket.join(`operator:${user.operatorProfile.id}`);
        socket.join('operators');
      }

      if (user.role === UserRole.PASSENGER) {
        socket.join('passengers');
      }
    } catch (error) {
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: Socket) {
    // No-op for now
  }

  @SubscribeMessage('passenger:subscribe')
  handlePassengerSubscribe(@ConnectedSocket() socket: Socket) {
    const user = socket.data.user;
    if (user?.role === UserRole.PASSENGER) {
      socket.join('passengers');
    }
  }

  @SubscribeMessage('operator:location')
  async handleOperatorLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { latitude: number; longitude: number },
  ) {
    const user = socket.data.user;
    if (!user || user.role !== UserRole.OPERATOR) {
      throw new WsException('Not allowed');
    }
    const operatorId = socket.data.operatorId;
    if (!operatorId) {
      throw new WsException('Operator profile missing');
    }
    if (
      typeof body?.latitude !== 'number' ||
      typeof body?.longitude !== 'number'
    ) {
      throw new WsException('Invalid location payload');
    }

    const updated = await this.operatorsService.updateLocation(
      operatorId,
      body.latitude,
      body.longitude,
    );

    if (updated) {
      this.emitBusLocation(updated);
    }
  }

  @SubscribeMessage('passenger:location')
  async handlePassengerLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { bookingId: string; latitude: number; longitude: number },
  ) {
    const user = socket.data.user;
    if (!user || user.role !== UserRole.PASSENGER) {
      throw new WsException('Not allowed');
    }
    if (
      typeof body?.bookingId !== 'string' ||
      typeof body?.latitude !== 'number' ||
      typeof body?.longitude !== 'number'
    ) {
      throw new WsException('Invalid location payload');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: body.bookingId },
      select: { id: true, passengerId: true, status: true },
    });
    if (!booking || booking.passengerId !== user.id) {
      throw new WsException('Booking not found');
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
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

  emitBusLocation(profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    phoneSecondary: string | null;
    phoneNumbers?: string[];
    busType: string | null;
    seatCount: number | null;
    plateNumber: string | null;
    price: number | null;
    destinations: string[];
    destinationsPricing?: any;
    isActive: boolean;
    lastLat: number | null;
    lastLng: number | null;
    lastLocationAt: Date | null;
  }) {
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

  @SubscribeMessage('rental:subscribe')
  async handleRentalSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const user = socket.data.user;
    const conversationId = body?.conversationId;
    if (!user || !conversationId) {
      throw new WsException('Invalid conversation');
    }
    const conversation = await this.prisma.rentalConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, passengerId: true, operatorId: true },
    });
    if (!conversation) {
      throw new WsException('Conversation not found');
    }
    const operatorId = socket.data.operatorId as string | undefined;
    const isPassenger = conversation.passengerId === user.id;
    const isOperator = operatorId && conversation.operatorId === operatorId;
    if (!isPassenger && !isOperator) {
      throw new WsException('Not allowed');
    }
    socket.join(`rental:conversation:${conversation.id}`);
  }

  emitRentalMessage(conversationId: string, payload: any) {
    this.server
      .to(`rental:conversation:${conversationId}`)
      .emit('rental:message', payload);
  }

  emitRentalRequest(payload: any) {
    this.server.to('operators').emit('rental:request', payload);
  }

  async emitBookingCreated(booking: any) {
    const payload = this.mapBooking(booking);
    this.server.to(`operator:${booking.operatorId}`).emit('booking:created', payload);
    this.server.to(`user:${booking.passengerId}`).emit('booking:created', payload);
  }

  async emitBookingUpdated(booking: any) {
    const payload = this.mapBooking(booking);
    this.server.to(`operator:${booking.operatorId}`).emit('booking:updated', payload);
    this.server.to(`user:${booking.passengerId}`).emit('booking:updated', payload);
  }

  private mapBooking(booking: any) {
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

  private extractToken(socket: Socket) {
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
}
