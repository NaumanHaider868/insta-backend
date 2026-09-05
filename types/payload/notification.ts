import { NotificationType } from '@prisma/client';

interface NotificationActor {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

interface NotificationItemResponse {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
  actor: NotificationActor;
}

interface NotificationListResponse {
  items: NotificationItemResponse[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type { NotificationActor, NotificationItemResponse, NotificationListResponse };
