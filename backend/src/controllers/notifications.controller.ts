import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { isDeviceType, DeviceTypeValue } from '../lib/enums';

/**
 * POST /api/notification-tokens — enregistre un token push (Expo Push, FCM...).
 * Body : { token: string, device_type: 'IOS' | 'ANDROID' | 'WEB' }
 */
export async function registerToken(req: Request, res: Response) {
  const { userId } = req.auth!;
  const { token, device_type: deviceType } = req.body as {
    token?: string;
    device_type?: string;
  };

  if (!token || !isDeviceType(deviceType)) {
    return res.status(400).json({ error: 'token et device_type (IOS/ANDROID/WEB) requis' });
  }
  const deviceTypeValue: DeviceTypeValue = deviceType;

  const saved = await prisma.notificationToken.upsert({
    where: { userId_token: { userId, token } },
    update: { deviceType: deviceTypeValue },
    create: { userId, token, deviceType: deviceTypeValue },
  });

  return res.status(201).json({ notification_token: saved });
}
