import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { uploadFile, createNotification } from '../services';
import { NotificationType } from '@prisma/client';

const uploadReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { caption } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const videoFile = files?.['video']?.[0];
    if (!videoFile) {
      return sendErrorResponse(res, 400, 'Video file is required');
    }

    const videoBlobPath = `reels/${currentUserId}/${Date.now()}-${videoFile.originalname}`;
    const videoUpload = await uploadFile(videoFile.buffer, videoBlobPath, videoFile.mimetype);

    let thumbnailUrl: string | null = null;
    const thumbnailFile = files?.['thumbnail']?.[0];
    if (thumbnailFile) {
      const thumbBlobPath = `reels/thumbnails/${currentUserId}/${Date.now()}-${thumbnailFile.originalname}`;
      const thumbUpload = await uploadFile(
        thumbnailFile.buffer,
        thumbBlobPath,
        thumbnailFile.mimetype
      );
      thumbnailUrl = thumbUpload.url;
    }

    const reel = await prisma.reel.create({
      data: {
        userId: currentUserId,
        videoUrl: videoUpload.url,
        thumbnailUrl,
        caption: caption || null,
      },
      include: {
        user: {
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

    return sendSuccessResponse(
      res,
      201,
      {
        ...reel,
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
      },
      'Reel uploaded successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const deleteReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const reel = await prisma.reel.findUnique({
      where: { id: id as string },
      select: { id: true, userId: true },
    });

    if (!reel) {
      return sendErrorResponse(res, 404, 'Reel not found');
    }

    if (reel.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to delete this reel');
    }

    await prisma.reel.delete({
      where: { id: id as string },
    });

    return sendSuccessResponse(res, 200, null, 'Reel deleted successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const reel = await prisma.reel.findUnique({
      where: { id: id as string },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: {
          where: { userId: currentUserId },
          select: { id: true },
        },
      },
    });

    if (!reel) {
      return sendErrorResponse(res, 404, 'Reel not found');
    }

    const { likes, _count, ...reelData } = reel;

    return sendSuccessResponse(
      res,
      200,
      {
        ...reelData,
        likesCount: _count.likes,
        commentsCount: _count.comments,
        isLiked: likes.length > 0,
      },
      'Reel retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getUserReels = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const [total, reels] = await Promise.all([
      prisma.reel.count({
        where: { userId: userId as string },
      }),
      prisma.reel.findMany({
        where: { userId: userId as string },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            where: { userId: currentUserId },
            select: { id: true },
          },
        },
      }),
    ]);

    const formattedReels = reels.map((reel) => {
      const { likes, _count, ...reelData } = reel;
      return {
        ...reelData,
        likesCount: _count.likes,
        commentsCount: _count.comments,
        isLiked: likes.length > 0,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(
      res,
      200,
      {
        items: formattedReels,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'User reels retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getReelsFeed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const following = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    const feedUserIds = [...followingIds, currentUserId];

    const [total, reels] = await Promise.all([
      prisma.reel.count({
        where: { userId: { in: feedUserIds } },
      }),
      prisma.reel.findMany({
        where: { userId: { in: feedUserIds } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            where: { userId: currentUserId },
            select: { id: true },
          },
        },
      }),
    ]);

    const formattedReels = reels.map((reel) => {
      const { likes, _count, ...reelData } = reel;
      return {
        ...reelData,
        likesCount: _count.likes,
        commentsCount: _count.comments,
        isLiked: likes.length > 0,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(
      res,
      200,
      {
        items: formattedReels,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Reels feed retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const likeReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: reelId } = req.params;
    const currentUserId = req.user!.id;

    const reel = await prisma.reel.findUnique({
      where: { id: reelId as string },
      select: { id: true, userId: true },
    });

    if (!reel) {
      return sendErrorResponse(res, 404, 'Reel not found');
    }

    const existingLike = await prisma.reelLike.findUnique({
      where: {
        userId_reelId: {
          userId: currentUserId,
          reelId: reelId as string,
        },
      },
    });

    if (existingLike) {
      await prisma.reelLike.delete({
        where: { id: existingLike.id },
      });
      return sendSuccessResponse(res, 200, { liked: false }, 'Reel unliked successfully');
    }

    await prisma.reelLike.create({
      data: {
        userId: currentUserId,
        reelId: reelId as string,
      },
    });

    await createNotification({
      userId: reel.userId,
      actorId: currentUserId,
      type: NotificationType.LIKE_REEL,
      entityId: reelId as string,
    });

    return sendSuccessResponse(res, 200, { liked: true }, 'Reel liked successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const unlikeReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: reelId } = req.params;
    const currentUserId = req.user!.id;

    const existingLike = await prisma.reelLike.findUnique({
      where: {
        userId_reelId: {
          userId: currentUserId,
          reelId: reelId as string,
        },
      },
    });

    if (!existingLike) {
      return sendErrorResponse(res, 404, 'Like not found');
    }

    await prisma.reelLike.delete({
      where: { id: existingLike.id },
    });

    return sendSuccessResponse(res, 200, { liked: false }, 'Reel unliked successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const commentReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: reelId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user!.id;

    const reel = await prisma.reel.findUnique({
      where: { id: reelId as string },
      select: { id: true, userId: true },
    });

    if (!reel) {
      return sendErrorResponse(res, 404, 'Reel not found');
    }

    const comment = await prisma.reelComment.create({
      data: {
        reelId: reelId as string,
        userId: currentUserId,
        content,
      },
      include: {
        user: {
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

    await createNotification({
      userId: reel.userId,
      actorId: currentUserId,
      type: NotificationType.COMMENT_REEL,
      entityId: comment.id,
    });

    return sendSuccessResponse(res, 201, comment, 'Comment added successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getReelComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: reelId } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const reel = await prisma.reel.findUnique({
      where: { id: reelId as string },
      select: { id: true },
    });

    if (!reel) {
      return sendErrorResponse(res, 404, 'Reel not found');
    }

    const [total, comments] = await Promise.all([
      prisma.reelComment.count({
        where: { reelId: reelId as string },
      }),
      prisma.reelComment.findMany({
        where: { reelId: reelId as string },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
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
        items: comments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Comments retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const deleteReelComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const currentUserId = req.user!.id;

    const comment = await prisma.reelComment.findUnique({
      where: { id: commentId as string },
      include: {
        reel: {
          select: { userId: true },
        },
      },
    });

    if (!comment) {
      return sendErrorResponse(res, 404, 'Comment not found');
    }

    if (comment.userId !== currentUserId && comment.reel.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to delete this comment');
    }

    await prisma.reelComment.delete({
      where: { id: commentId as string },
    });

    return sendSuccessResponse(res, 200, null, 'Comment deleted successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export {
  uploadReel,
  deleteReel,
  getReel,
  getUserReels,
  getReelsFeed,
  likeReel,
  unlikeReel,
  commentReel,
  getReelComments,
  deleteReelComment,
};
