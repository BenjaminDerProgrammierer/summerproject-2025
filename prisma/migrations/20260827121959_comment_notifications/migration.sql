-- AlterTable
ALTER TABLE "users" ADD COLUMN     "comment_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reply_notifications" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "email_notifications" SET DEFAULT true;
