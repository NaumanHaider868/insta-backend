import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { uploadFile, deleteFiles, createNotification } from '../services';
import { NotificationType } from '@prisma/client';

const uploadReel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { caption } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const videoFiles = files?.['video'] || [];
    if (videoFiles.length === 0) {
      return sendErrorResponse(res, 400, 'Video file is required');
    }

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

    const uploadedVideos = [];
    for (const [index, videoFile] of videoFiles.entries()) {
      const videoBlobPath = `reels/${currentUserId}/${Date.now()}-${index}-${videoFile.originalname}`;
      const videoUpload = await uploadFile(videoFile.buffer, videoBlobPath, videoFile.mimetype);
      uploadedVideos.push({ url: videoUpload.url, order: index });
    }

    const reel = await prisma.reel.create({
      data: {
        userId: currentUserId,
        videoUrl: uploadedVideos[0].url,
        thumbnailUrl,
        caption: caption || null,
        media: {
          create: uploadedVideos,
        },
      },
      include: {
        media: {
          orderBy: { order: 'asc' },
        },
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
    const responseReel = {
      ...reel,
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
    };

    return sendSuccessResponse(
      res,
      201,
      responseReel,
      `${uploadedVideos.length} video${uploadedVideos.length === 1 ? '' : 's'} uploaded as one reel`
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const updateReel = async (req: AuthenticatedRequest, res: Response) => {
  const uploadedUrls: string[] = [];
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const { caption, retainedMediaIds: retainedMediaIdsValue } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const videoFiles = files?.['video'] || [];
    const reel = await prisma.reel.findUnique({
      where: { id: id as string },
      include: { media: { orderBy: { order: 'asc' } } },
    });

    if (!reel) return sendErrorResponse(res, 404, 'Reel not found');
    if (reel.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to edit this reel');
    }

    let retainedMediaIds: string[];
    try {
      retainedMediaIds = JSON.parse(retainedMediaIdsValue);
    } catch {
      return sendErrorResponse(res, 400, 'Invalid media selection');
    }

    const existingMedia = new Map(reel.media.map((media) => [media.id, media]));
    if (
      !Array.isArray(retainedMediaIds) ||
      retainedMediaIds.some((mediaId) => typeof mediaId !== 'string' || !existingMedia.has(mediaId))
    ) {
      return sendErrorResponse(res, 400, 'Invalid media selection');
    }
    if (retainedMediaIds.length + videoFiles.length === 0) {
      return sendErrorResponse(res, 400, 'A reel must contain at least one video');
    }
    if (retainedMediaIds.length + videoFiles.length > 10) {
      return sendErrorResponse(res, 400, 'A reel can contain at most 10 videos');
    }

    const newMedia: { url: string; order: number }[] = [];
    for (const [index, file] of videoFiles.entries()) {
      const uploaded = await uploadFile(
        file.buffer,
        `reels/${currentUserId}/${Date.now()}-${index}-${file.originalname}`,
        file.mimetype
      );
      uploadedUrls.push(uploaded.url);
      newMedia.push({ url: uploaded.url, order: retainedMediaIds.length + index });
    }

    const retainedMedia = retainedMediaIds.map((mediaId) => existingMedia.get(mediaId)!);
    const firstVideoUrl = retainedMedia[0]?.url || newMedia[0].url;
    const removedUrls = reel.media
      .filter((media) => !retainedMediaIds.includes(media.id))
      .map((media) => media.url);

    const updatedReel = await prisma.$transaction(async (transaction) => {
      await transaction.reelMedia.deleteMany({
        where: { reelId: reel.id, id: { notIn: retainedMediaIds } },
      });
      await Promise.all(
        retainedMediaIds.map((mediaId, order) =>
          transaction.reelMedia.update({ where: { id: mediaId }, data: { order } })
        )
      );
      if (newMedia.length > 0) {
        await transaction.reelMedia.createMany({
          data: newMedia.map((media) => ({ ...media, reelId: reel.id })),
        });
      }
      return transaction.reel.update({
        where: { id: reel.id },
        data: {
          videoUrl: firstVideoUrl,
          ...(caption === undefined ? {} : { caption: caption || null }),
        },
        include: {
          media: { orderBy: { order: 'asc' } },
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
    });

    try {
      await deleteFiles(removedUrls);
    } catch (deleteError) {
      console.error('Failed to remove replaced reel media from blob storage', deleteError);
    }

    return sendSuccessResponse(res, 200, updatedReel, 'Reel updated successfully');
  } catch (error) {
    if (uploadedUrls.length > 0) {
      try {
        await deleteFiles(uploadedUrls);
      } catch {
        // Preserve the original update error.
      }
    }
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
          media: { orderBy: { order: 'asc' } },
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

    const [total, reels] = await Promise.all([
      prisma.reel.count(),
      prisma.reel.findMany({
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
  updateReel,
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
