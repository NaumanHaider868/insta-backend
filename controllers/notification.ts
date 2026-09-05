import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const [unreadCount, total, notifications] = await Promise.all([
      prisma.notification.count({
        where: {
          userId: currentUserId,
          isRead: false,
        },
      }),
      prisma.notification.count({
        where: {
          userId: currentUserId,
        },
      }),
      prisma.notification.findMany({
        where: {
          userId: currentUserId,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
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
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(
      res,
      200,
      {
        items: notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Notifications retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const notification = await prisma.notification.findUnique({
      where: { id: id as string },
      select: { id: true, userId: true, isRead: true },
    });

    if (!notification) {
      return sendErrorResponse(res, 404, 'Notification not found');
    }

    if (notification.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to update this notification');
    }

    const updated = await prisma.notification.update({
      where: { id: id as string },
      data: { isRead: true },
    });

    return sendSuccessResponse(res, 200, updated, 'Notification marked as read');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        userId: currentUserId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return sendSuccessResponse(res, 200, null, 'All notifications marked as read');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export { getNotifications, markAsRead, markAllAsRead };
