import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { checkJwtToken } from '../utils';
import { TokenIdentifier } from '../enums';
import { prisma } from '../config';
import { createNotification } from '../services';
import { NotificationType } from '@prisma/client';

interface SocketUser {
  id: string;
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
}

interface CustomSocket extends Socket {
  data: {
    user?: SocketUser;
  };
}

let io: Server | null = null;
const userSocketsMap = new Map<string, Set<string>>();
const userActiveConversationMap = new Map<string, string>();

const getIO = (): Server | null => {
  return io;
};

const initSocketIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // JWT Authentication Middleware for Socket Handshake
  io.use(async (socket: CustomSocket, next) => {
    try {
      const authHeader =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization as string | undefined) ||
        (socket.handshake.query?.token as string | undefined);

      if (!authHeader) {
        return next(new Error('Authentication token required'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

      const { isValid, payload, error } = checkJwtToken<{ id: string }>(token, ['id'], {
        reference: TokenIdentifier.Login,
      });

      if (!isValid || !payload) {
        return next(new Error(error || 'Invalid token'));
      }

      const user = await prisma.users.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          email: true,
          userName: true,
          firstName: true,
          lastName: true,
          isVerified: true,
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      if (!user.isVerified) {
        return next(new Error('User not verified'));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', async (socket: CustomSocket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const userId = user.id;
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // Track active connection
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    userSocketsMap.get(userId)!.add(socket.id);

    // Mark online
    const now = new Date();
    await prisma.users.update({
      where: { id: userId },
      data: {
        isOnline: true,
        lastSeen: now,
      },
    });

    // Broadcast presence update
    io?.emit('user:presence', {
      userId,
      isOnline: true,
      lastSeen: now.toISOString(),
    });

    // Event: message:send
    socket.on(
      'message:send',
      async (
        data: { receiverId: string; content: string },
        callback?: (response: unknown) => void
      ) => {
        try {
          const { receiverId, content } = data;
          if (!receiverId || !content || receiverId === userId) {
            callback?.({ status: 'error', message: 'Invalid message payload' });
            return;
          }

          const receiver = await prisma.users.findUnique({
            where: { id: receiverId },
            select: { id: true, isVerified: true },
          });

          if (!receiver || !receiver.isVerified) {
            callback?.({ status: 'error', message: 'Receiver not available' });
            return;
          }

          const message = await prisma.message.create({
            data: {
              senderId: userId,
              receiverId,
              content,
              isReceived: true,
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
          });

          // Emit to receiver's personal room
          io?.to(`user:${receiverId}`).emit('message:receive', message);
          // Confirm to sender
          socket.emit('message:sent', message);

          // Create a MESSAGE notification if receiver isn't actively viewing that conversation
          const receiverActivePartner = userActiveConversationMap.get(receiverId);
          if (receiverActivePartner !== userId) {
            await createNotification({
              userId: receiverId,
              actorId: userId,
              type: NotificationType.MESSAGE,
              entityId: message.id,
            });
          }

          callback?.({ status: 'success', data: message });
        } catch {
          callback?.({ status: 'error', message: 'Failed to send message' });
        }
      }
    );

    // Event: conversation:enter
    socket.on('conversation:enter', (data: { partnerId: string }) => {
      if (data?.partnerId) {
        userActiveConversationMap.set(userId, data.partnerId);
      }
    });

    // Event: conversation:leave
    socket.on('conversation:leave', () => {
      userActiveConversationMap.delete(userId);
    });

    // Event: message:read
    socket.on(
      'message:read',
      async (data: { senderId: string }, callback?: (response: unknown) => void) => {
        try {
          const { senderId } = data;
          if (!senderId) {
            callback?.({ status: 'error', message: 'Sender id required' });
            return;
          }

          await prisma.message.updateMany({
            where: {
              senderId,
              receiverId: userId,
              isRead: false,
            },
            data: {
              isRead: true,
            },
          });

          // Notify sender that messages have been read
          io?.to(`user:${senderId}`).emit('message:read', {
            readBy: userId,
            conversationPartnerId: senderId,
          });

          callback?.({ status: 'success' });
        } catch {
          callback?.({ status: 'error', message: 'Failed to mark messages as read' });
        }
      }
    );

    // Event: typing:start
    socket.on('typing:start', (data: { receiverId: string }) => {
      if (data?.receiverId) {
        io?.to(`user:${data.receiverId}`).emit('typing:start', {
          senderId: userId,
          userName: user.userName,
        });
      }
    });

    // Event: typing:stop
    socket.on('typing:stop', (data: { receiverId: string }) => {
      if (data?.receiverId) {
        io?.to(`user:${data.receiverId}`).emit('typing:stop', {
          senderId: userId,
        });
      }
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      userActiveConversationMap.delete(userId);
      const userSockets = userSocketsMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);

          const disconnectTime = new Date();
          await prisma.users.update({
            where: { id: userId },
            data: {
              isOnline: false,
              lastSeen: disconnectTime,
            },
          });

          io?.emit('user:presence', {
            userId,
            isOnline: false,
            lastSeen: disconnectTime.toISOString(),
          });
        }
      }
    });
  });

  return io;
};

export { initSocketIO, getIO };
