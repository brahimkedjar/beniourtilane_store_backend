-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "passengerLat" DOUBLE PRECISION,
ADD COLUMN     "passengerLng" DOUBLE PRECISION,
ADD COLUMN     "passengerLocationAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OperatorProfile" ADD COLUMN     "destinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phoneSecondary" TEXT,
ADD COLUMN     "price" INTEGER,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "busType" DROP NOT NULL,
ALTER COLUMN "seatCount" DROP NOT NULL;
