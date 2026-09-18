import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification';
import { authenticate } from '../middlewares';
import { notificationValidator, NotificationSchema } from '../validators/notification';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  notificationValidator.getMiddleware(NotificationSchema.Get_Notifications, {
    isQueryParams: true,
  }),
  getNotifications
);
router.patch('/read-all', markAllAsRead);
router.patch(
  '/:id/read',
  notificationValidator.getMiddleware(NotificationSchema.Mark_Read, { isParams: true }),
  markAsRead
);

export default router;
