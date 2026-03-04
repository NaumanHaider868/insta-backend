import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { SendMessagePayload } from '../types';

const sendMessage = async (
  req: AuthenticatedRequest & { body: SendMessagePayload },
  res: Response
) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user!.id;

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

    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        receiverId,
      },
      include: {
        sender: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return sendSuccessResponse(res, 201, message, 'Message sent successfully');
  } catch (error) {
    return appErrorResponse(res, error);
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
      where: { id: userId },
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
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Mark messages as read where current user is receiver
    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUserId,
        isRead: false,
      },
      data: {
        isRead: true,
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
          },
        },
        receiver: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group messages by conversation partner and get the latest message for each
    const conversations = new Map();

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
        });
      }
    }

    const conversationList = Array.from(conversations.values());

    return sendSuccessResponse(res, 200, conversationList, 'Conversations retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

export { sendMessage, getConversation, getConversations };
