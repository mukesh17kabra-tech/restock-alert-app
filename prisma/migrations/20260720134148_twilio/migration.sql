-- DropIndex
DROP INDEX "public"."VariantSubscriber_shopId_variantId_email_key";

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "currentCycleStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notifyChannels" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "recurringChargeId" TEXT,
ADD COLUMN     "twilioSenderSid" TEXT,
ADD COLUMN     "whatsappConnectedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappMessagesThisCycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "whatsappSenderStatus" TEXT;

-- AlterTable
ALTER TABLE "VariantSubscriber" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
