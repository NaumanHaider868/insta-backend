import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { SendMessagePayload } from '../types';
import { getIO } from '../sockets';
import { createNotification } from '../services';
import { NotificationType } from '@prisma/client';

const sendMessage = async (
  req: AuthenticatedRequest & { body: SendMessagePayload },
  res: Response
) => {
  try {
    const { receiverId, content } = req.body;
    const { id: senderId } = req.user;

    if (receiverId === senderId) {
      return sendErrorResponse(res, 400, 'Cannot send message to yourself');
    }

    const receiver = await prisma.users.findUnique({
      where: { id: receiverId },
      select: { id: true, isVerified: true },
    });

    if (!receiver) {
      return sendErrorResponse(res, 404, 'Receiver not found');
    }

    if (!receiver.isVerified) {
      return sendErrorResponse(res, 400, 'Receiver is not verified');
    }

    const io = getIO();
    const isReceived = Boolean(io?.sockets.adapter.rooms.get(`user:${receiverId}`)?.size);
    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        receiverId,
        isReceived,
      },
      include: {
        sender: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            isOnline: true,
            lastSeen: true,
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });

    if (io) {
      io.to(`user:${receiverId}`).emit('message:receive', message);
      io.to(`user:${senderId}`).emit('message:sent', message);
      if (isReceived) {
        io.to(`user:${senderId}`).emit('message:delivered', {
          messageId: message.id,
          receiverId,
        });
      }
    }

    await createNotification({
      userId: receiverId,
      actorId: senderId,
      type: NotificationType.MESSAGE,
      entityId: message.id,
    });

    return sendSuccessResponse(res, 200, message, 'Message sent successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    if (userId === currentUserId) {
      return sendErrorResponse(res, 400, 'Cannot get conversation with yourself');
    }

    // Check if user exists
    const otherUser = await prisma.users.findUnique({
      where: { id: userId as string },
      select: { id: true, isVerified: true },
    });

    if (!otherUser) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    if (!otherUser.isVerified) {
      return sendErrorResponse(res, 400, 'User is not verified');
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId as string },
          { senderId: userId as string, receiverId: currentUserId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return sendSuccessResponse(res, 200, messages, 'Conversation retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    // Get all messages where current user is either sender or receiver
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            isOnline: true,
            lastSeen: true,
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group messages by conversation partner and get the latest message for each
    const conversations = new Map<string, {
      user: typeof messages[number]['sender'];
      lastMessage: {
        id: string;
        content: string;
        isRead: boolean;
        createdAt: string;
        senderId: string;
        receiverId: string;
      };
      unreadCount: number;
    }>();

    for (const message of messages) {
      const partnerId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      const partner = message.senderId === currentUserId ? message.receiver : message.sender;

      if (!conversations.has(partnerId)) {
        conversations.set(partnerId, {
          user: partner,
          lastMessage: {
            id: message.id,
            content: message.content,
            isRead: message.isRead,
            createdAt: message.createdAt.toISOString(),
            senderId: message.senderId,
            receiverId: message.receiverId,
          },
          unreadCount: 0,
        });
      }

      if (message.receiverId === currentUserId && !message.isRead) {
        conversations.get(partnerId)!.unreadCount += 1;
      }
    }

    const conversationList = Array.from(conversations.values());

    return sendSuccessResponse(res, 200, conversationList, 'Conversations retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const searchUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      return sendSuccessResponse(res, 200, { items: [] }, 'Enter at least two characters');
    }

    const users = await prisma.users.findMany({
      where: {
        id: { not: currentUserId },
        isVerified: true,
        OR: [
          { userName: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
        ],
      },
      take: 20,
      orderBy: { userName: 'asc' },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        isOnline: true,
        lastSeen: true,
      },
    });

    return sendSuccessResponse(res, 200, { items: users }, 'Users retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export { sendMessage, getConversation, getConversations, searchUsers };
