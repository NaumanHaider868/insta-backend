import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { createNotification } from '../services';
import { NotificationType } from '@prisma/client';

const followUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user!.id;

    if (followingId === followerId) {
      return sendErrorResponse(res, 400, 'Cannot follow yourself');
    }

    const targetUser = await prisma.users.findUnique({
      where: { id: followingId as string },
      select: { id: true, isVerified: true },
    });

    if (!targetUser) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    if (!targetUser.isVerified) {
      return sendErrorResponse(res, 400, 'User is not verified');
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingId as string,
        },
      },
    });

    if (existingFollow) {
      return sendErrorResponse(res, 400, 'You are already following this user');
    }

    const follow = await prisma.follow.create({
      data: {
        followerId,
        followingId: followingId as string,
      },
    });

    await createNotification({
      userId: followingId as string,
      actorId: followerId,
      type: NotificationType.FOLLOW,
      entityId: follow.id,
    });

    return sendSuccessResponse(res, 201, follow, 'User followed successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const unfollowUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user!.id;

    if (followingId === followerId) {
      return sendErrorResponse(res, 400, 'Cannot unfollow yourself');
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingId as string,
        },
      },
    });

    if (!existingFollow) {
      return sendErrorResponse(res, 404, 'You are not following this user');
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingId as string,
        },
      },
    });

    return sendSuccessResponse(res, 200, null, 'User unfollowed successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getFollowers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const user = await prisma.users.findUnique({
      where: { id: userId as string },
      select: { id: true },
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    const [total, followers] = await Promise.all([
      prisma.follow.count({
        where: { followingId: userId as string },
      }),
      prisma.follow.findMany({
        where: { followingId: userId as string },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
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

    const items = followers.map((f) => f.follower);
    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(
      res,
      200,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Followers retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getFollowing = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const user = await prisma.users.findUnique({
      where: { id: userId as string },
      select: { id: true },
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    const [total, following] = await Promise.all([
      prisma.follow.count({
        where: { followerId: userId as string },
      }),
      prisma.follow.findMany({
        where: { followerId: userId as string },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
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

    const items = following.map((f) => f.following);
    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(
      res,
      200,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Following retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getFollowStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user!.id;

    if (targetUserId === currentUserId) {
      return sendSuccessResponse(res, 200, {
        isFollowing: false,
        isFollowedBy: false,
      });
    }

    const [isFollowingRecord, isFollowedByRecord] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId as string,
          },
        },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: targetUserId as string,
            followingId: currentUserId,
          },
        },
      }),
    ]);

    return sendSuccessResponse(
      res,
      200,
      {
        isFollowing: !!isFollowingRecord,
        isFollowedBy: !!isFollowedByRecord,
      },
      'Follow status retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export { followUser, unfollowUser, getFollowers, getFollowing, getFollowStatus };
