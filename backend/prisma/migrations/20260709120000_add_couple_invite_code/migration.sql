-- Ajout du code d'invitation du couple
ALTER TABLE "couples" ADD COLUMN "invite_code" TEXT;
CREATE UNIQUE INDEX "couples_invite_code_key" ON "couples"("invite_code");
