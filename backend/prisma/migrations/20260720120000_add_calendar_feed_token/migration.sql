-- Jeton secret d'abonnement au flux ICS (par utilisateur)
ALTER TABLE "users" ADD COLUMN "calendar_feed_token" TEXT;
CREATE UNIQUE INDEX "users_calendar_feed_token_key" ON "users"("calendar_feed_token");
