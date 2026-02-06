-- AlterTable
ALTER TABLE "OperatorProfile" ADD COLUMN     "destinationsPricing" JSONB,
ADD COLUMN     "phoneNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
