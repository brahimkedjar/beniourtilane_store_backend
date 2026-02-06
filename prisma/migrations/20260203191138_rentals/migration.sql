-- CreateEnum
CREATE TYPE "RentalVehicleKind" AS ENUM ('BUS', 'CAR');

-- CreateEnum
CREATE TYPE "RentalListingStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RentalRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RentalListing" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "vehicleKind" "RentalVehicleKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pricePerDay" INTEGER,
    "seatCount" INTEGER,
    "plateNumber" TEXT,
    "location" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "status" "RentalListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reservedFrom" TIMESTAMP(3),
    "reservedTo" TIMESTAMP(3),
    "reservedRequestId" TEXT,
    "reservedPassengerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRequest" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "vehicleKind" "RentalVehicleKind" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "seatCount" INTEGER,
    "budget" INTEGER,
    "notes" TEXT,
    "status" "RentalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalConversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "requestId" TEXT,
    "passengerId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentalListing_reservedRequestId_key" ON "RentalListing"("reservedRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalConversation_listingId_passengerId_key" ON "RentalConversation"("listingId", "passengerId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalConversation_requestId_operatorId_key" ON "RentalConversation"("requestId", "operatorId");

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_reservedRequestId_fkey" FOREIGN KEY ("reservedRequestId") REFERENCES "RentalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalConversation" ADD CONSTRAINT "RentalConversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RentalListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalConversation" ADD CONSTRAINT "RentalConversation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RentalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalConversation" ADD CONSTRAINT "RentalConversation_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalConversation" ADD CONSTRAINT "RentalConversation_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalMessage" ADD CONSTRAINT "RentalMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RentalConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalMessage" ADD CONSTRAINT "RentalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
