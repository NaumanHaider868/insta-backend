import { IncomingMessage, Server as HttpServer } from 'http';
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
let relayStarted = false;
let relayRunning = false;
let messageCursor = new Date();
let notificationCursor = new Date();
const seenMessageIds = new Set<string>();
const seenNotificationIds = new Set<string>();
const presenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const deliveredSweepAt = new Map<string, number>();

const chatUserSelect = {
  id: true,
  userName: true,
  firstName: true,
  lastName: true,
  profileImage: true,
};

const rememberId = (seenIds: Set<string>, id: string) => {
  seenIds.add(id);
  if (seenIds.size <= 1000) return;
  const oldestId = seenIds.values().next().value;
  if (oldestId) seenIds.delete(oldestId);
};

const schedulePresence = (userId: string) => {
  const existingTimer = presenceTimers.get(userId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    presenceTimers.delete(userId);
    const isOnline = Boolean(userSocketsMap.get(userId)?.size);
    const lastSeen = new Date();
    void prisma.users
      .update({
        where: { id: userId },
        data: { isOnline, lastSeen },
      })
      .then(() => {
        io?.emit('user:presence', {
          userId,
          isOnline,
          lastSeen: lastSeen.toISOString(),
        });
      })
      .catch((error) => {
        console.error('presence update failed', error);
      });
  }, 2000);

  presenceTimers.set(userId, timer);
};

const relaySocketEvents = async () => {
  const userIds = [...userSocketsMap.keys()];
  if (!io || userIds.length === 0 || relayRunning) return;
  relayRunning = true;

  try {
    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: messageCursor },
        OR: [{ receiverId: { in: userIds } }, { senderId: { in: userIds } }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: chatUserSelect },
        receiver: { select: chatUserSelect },
      },
    });

    for (const message of messages) {
      if (message.createdAt > messageCursor) messageCursor = message.createdAt;
      if (seenMessageIds.has(message.id)) continue;
      rememberId(seenMessageIds, message.id);

      if (userSocketsMap.has(message.receiverId)) {
        io.to(`user:${message.receiverId}`).emit('message:receive', message);
      }
      if (userSocketsMap.has(message.senderId)) {
        io.to(`user:${message.senderId}`).emit('message:sent', message);
      }
    }

    const notifications = await prisma.notification.findMany({
      where: {
        createdAt: { gte: notificationCursor },
        userId: { in: userIds },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: chatUserSelect },
      },
    });

    for (const notification of notifications) {
      if (notification.createdAt > notificationCursor) notificationCursor = notification.createdAt;
      if (seenNotificationIds.has(notification.id)) continue;
      rememberId(seenNotificationIds, notification.id);
      if (userSocketsMap.has(notification.userId)) {
        io.to(`user:${notification.userId}`).emit('notification:new', notification);
      }
    }
  } catch (error) {
    console.error('socket relay failed', error);
  } finally {
    relayRunning = false;
  }
};

const startSocketRelay = () => {
  if (relayStarted) return;
  relayStarted = true;
  const startedAt = new Date(Date.now() - 2000);
  messageCursor = startedAt;
  notificationCursor = startedAt;
  setInterval(() => {
    void relaySocketEvents();
  }, 3000);
};

const getIO = (): Server | null => {
  return io;
};

const SOCKET_PATH = '/api/socket-io';

const normalizeSocketUrl = (req: IncomingMessage) => {
  const rawUrl = req.url || '/';
  const queryIndex = rawUrl.indexOf('?');
  const pathname = (queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex)).replace(/\/$/, '') || '/';
  const query = queryIndex === -1 ? '' : rawUrl.slice(queryIndex);
  const engineHandshake = query.includes('EIO=') || query.includes('transport=');
  const socketPath = pathname === SOCKET_PATH || pathname === '/socket.io' || (pathname === '/' && engineHandshake);

  if (socketPath) {
    req.url = `${SOCKET_PATH}${query}`;
  }
};

const initSocketIO = (httpServer: HttpServer): Server => {
  // Live route is the Vercel function /api/socket-io. Extra /socket.io segments 404 before Node.
  httpServer.on('request', normalizeSocketUrl);
  httpServer.on('upgrade', normalizeSocketUrl);

  const onVercel = Boolean(process.env.VERCEL);

  io = new Server(httpServer, {
    path: SOCKET_PATH,
    // The WebSocket upgrade crashes this Vercel function. Polling completes the handshake.
    transports: onVercel ? ['polling'] : ['polling', 'websocket'],
    allowUpgrades: !onVercel,
    cors: {
      origin: process.env.FRONTEND_URL,
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

    if (userSocketsMap.get(userId)?.size === 1) {
      schedulePresence(userId);
    }

    const lastSweep = deliveredSweepAt.get(userId) || 0;
    if (Date.now() - lastSweep > 15000) {
      deliveredSweepAt.set(userId, Date.now());
      const pendingMessages = await prisma.message.findMany({
        where: { receiverId: userId, isReceived: false },
        select: { id: true, senderId: true },
      });
      if (pendingMessages.length > 0) {
        await prisma.message.updateMany({
          where: { id: { in: pendingMessages.map(({ id }) => id) } },
          data: { isReceived: true },
        });
        for (const pendingMessage of pendingMessages) {
          io?.to(`user:${pendingMessage.senderId}`).emit('message:delivered', {
            messageId: pendingMessage.id,
            receiverId: userId,
          });
        }
      }
    }

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

          const receiverOnline = Boolean(userSocketsMap.get(receiverId)?.size);
          const message = await prisma.message.create({
            data: {
              senderId: userId,
              receiverId,
              content,
              isReceived: receiverOnline,
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
          if (receiverOnline) {
            io?.to(`user:${userId}`).emit('message:delivered', {
              messageId: message.id,
              receiverId,
            });
          }

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

          if (userActiveConversationMap.get(userId) !== senderId) {
            callback?.({ status: 'error', message: 'Conversation is not active' });
            return;
          }

          const unreadMessages = await prisma.message.findMany({
            where: {
              senderId,
              receiverId: userId,
              isRead: false,
            },
            select: { id: true },
          });
          const readResult = unreadMessages.length
            ? await prisma.message.updateMany({
                where: { id: { in: unreadMessages.map(({ id }) => id) } },
                data: { isRead: true },
              })
            : { count: 0 };

          if (readResult.count > 0) {
            io?.to(`user:${senderId}`).emit('message:read', {
              readBy: userId,
              conversationPartnerId: senderId,
            });
          }

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
          schedulePresence(userId);
        }
      }
    });
  });

  // Live browsers can land on different servers. The database is the shared copy those servers read.
  startSocketRelay();

  return io;
};

export { initSocketIO, getIO };
