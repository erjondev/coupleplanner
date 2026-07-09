import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

/** Alphabet sans caractères ambigus (pas de O/0/I/1) pour un code lisible. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Génère un code d'invitation unique (réessaie en cas de collision). */
async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const clash = await prisma.couple.findUnique({ where: { inviteCode: code } });
    if (!clash) return code;
  }
  throw new Error("Impossible de générer un code d'invitation");
}

/** Construit le corps de réponse commun (profil + partenaire + code couple). */
async function sessionPayload(user: Pick<User, 'id' | 'email' | 'name' | 'coupleId'>) {
  const partner = user.coupleId
    ? await prisma.user.findFirst({
        where: { coupleId: user.coupleId, id: { not: user.id } },
        select: { id: true, name: true },
      })
    : null;

  const couple = user.coupleId
    ? await prisma.couple.findUnique({
        where: { id: user.coupleId },
        select: { inviteCode: true },
      })
    : null;

  return {
    user: { id: user.id, email: user.email, name: user.name, coupleId: user.coupleId },
    partner,
    // inviteCode utile tant qu'il n'y a pas de partenaire (à partager)
    couple: { inviteCode: couple?.inviteCode ?? null },
  };
}

/**
 * POST /api/auth/signup — { email, password, name, invite_code? }
 * - Sans code : crée un nouveau couple (+ espace commun) et le compte.
 * - Avec code : rejoint le couple existant du partenaire.
 * Dans les deux cas, crée l'espace privé du nouvel utilisateur.
 */
export async function signup(req: Request, res: Response) {
  const { email, password, name, invite_code: inviteCode } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    invite_code?: string;
  };

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user: User;

  try {
    if (inviteCode) {
      // --- Rejoindre un couple existant via le code ---
      const code = inviteCode.trim().toUpperCase();
      const couple = await prisma.couple.findUnique({
        where: { inviteCode: code },
        include: { users: { select: { id: true } } },
      });
      if (!couple) {
        return res.status(400).json({ error: "Code d'invitation invalide" });
      }
      if (couple.users.length >= 2) {
        return res.status(400).json({ error: 'Ce couple est déjà complet (2 membres).' });
      }

      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email: normalizedEmail, name: name.trim(), passwordHash, coupleId: couple.id },
        });
        // Espace privé du nouvel arrivant (l'espace commun existe déjà)
        await tx.environment.create({
          data: { coupleId: couple.id, userId: u.id, type: 'PRIVATE' },
        });
        return u;
      });
    } else {
      // --- Créer un nouveau couple ---
      const code = await generateUniqueInviteCode();
      user = await prisma.$transaction(async (tx) => {
        const couple = await tx.couple.create({ data: { inviteCode: code } });
        const u = await tx.user.create({
          data: { email: normalizedEmail, name: name.trim(), passwordHash, coupleId: couple.id },
        });
        // Espace commun du couple + espace privé du créateur
        await tx.environment.create({
          data: { coupleId: couple.id, userId: null, type: 'SHARED' },
        });
        await tx.environment.create({
          data: { coupleId: couple.id, userId: u.id, type: 'PRIVATE' },
        });
        return u;
      });
    }
  } catch (e) {
    console.error('Signup échoué :', e);
    return res.status(500).json({ error: 'Création du compte impossible' });
  }

  const payload = await sessionPayload(user);
  return res.status(201).json({
    token: signToken({ userId: user.id, coupleId: user.coupleId! }),
    ...payload,
  });
}

/** POST /api/auth/login — { email, password } */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
  if (!user.coupleId) {
    return res.status(403).json({ error: "L'utilisateur n'appartient à aucun couple" });
  }

  const payload = await sessionPayload(user);
  return res.json({
    token: signToken({ userId: user.id, coupleId: user.coupleId }),
    ...payload,
  });
}

/** GET /api/auth/me — profil courant + partenaire + code d'invitation */
export async function me(req: Request, res: Response) {
  const { userId } = req.auth!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, coupleId: true },
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const payload = await sessionPayload(user);
  return res.json(payload);
}
