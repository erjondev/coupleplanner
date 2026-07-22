-- Propositions d'activité au partenaire : statut de validation sur les tâches.
-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('NONE', 'PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "proposal_status" "ProposalStatus" NOT NULL DEFAULT 'NONE';
