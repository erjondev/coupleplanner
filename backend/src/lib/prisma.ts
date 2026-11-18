import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique partagée par toute l'application.
 *
 * Deux schémas coexistent :
 *  - prisma/schema.prisma      → PRODUCTION : PostgreSQL (alwaysdata), enums natifs.
 *  - prisma/dev/schema.prisma  → DEV LOCAL : SQLite (fichier dev.db), enums en String.
 *
 * Le choix se fait sur DATABASE_URL : "file:..." (SQLite) oriente vers le client
 * généré dans prisma/dev-client ; toute autre URL (postgresql://...) utilise le
 * client standard @prisma/client. Comme les deux clients ont la même API, le reste
 * du code ne voit aucune différence.
 */

let prisma: PrismaClient;

if ((process.env.DATABASE_URL ?? '').startsWith('file:')) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient: DevPrismaClient } = require('../../prisma/dev-client');
  prisma = new DevPrismaClient() as unknown as PrismaClient;
} else {
  prisma = new PrismaClient();
}

export { prisma };
