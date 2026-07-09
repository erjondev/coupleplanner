import { Request, Response } from 'express';
import { DeviceType } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * POST /api/notification-tokens — enregistre un token push (Expo Push, FCM...).
 * Body : { token: string, device_type: 'IOS' | 'ANDROID' | 'WEB' }
 */
export async function registerToken(req: Request, res: Response) {
  const { userId } = req.auth!;
  const { token, device_type: deviceType } = req.body as {
    token?: string;
    device_type?: DeviceType;
  };

  if (!token || !deviceType || !Object.values(DeviceType).includes(deviceType)) {
    return res.status(400).json({ error: 'token et device_type (IOS/ANDROID/WEB) requis' });
  }

  const saved = await prisma.notificationToken.upsert({
    where: { userId_token: { userId, token } },
    update: { deviceType },
    create: { userId, token, deviceType },
  });

  return res.status(201).json({ notification_token: saved });
}
