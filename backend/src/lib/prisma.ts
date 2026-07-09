import { PrismaClient } from '@prisma/client';

/** Instance Prisma unique partagée par toute l'application. */
export const prisma = new PrismaClient();
