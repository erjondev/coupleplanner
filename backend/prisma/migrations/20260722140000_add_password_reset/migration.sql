-- Réinitialisation de mot de passe : code (hashé) + expiration, par utilisateur.
ALTER TABLE "users" ADD COLUMN "reset_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token_expires_at" TIMESTAMP(3);
