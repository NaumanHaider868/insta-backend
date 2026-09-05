import { NotificationType } from '@prisma/client';
import { prisma } from '../config';
import { getIO } from '../sockets';

interface CreateNotificationParams {
  userId: string;
  actorId: string;
  type: NotificationType;
  entityId?: string;
}

const createNotification = async ({
  userId,
  actorId,
  type,
  entityId,
}: CreateNotificationParams) => {
  try {
    if (userId === actorId) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        entityId,
      },
      include: {
        actor: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

export { createNotification };
export type { CreateNotificationParams };
