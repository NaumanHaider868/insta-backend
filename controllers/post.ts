import { Response } from 'express';
import { prisma } from '../config';
import { sendErrorResponse, sendSuccessResponse, appErrorResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { uploadFile, createNotification } from '../services';
import { NotificationType, PostMediaType } from '@prisma/client';

const createPost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const { caption } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return sendErrorResponse(res, 400, 'At least one image is required to create a post');
    }

    const uploadedMedia: { url: string; order: number; mediaType: PostMediaType }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blobPath = `posts/${currentUserId}/${Date.now()}-${i}-${file.originalname}`;
      const uploadResult = await uploadFile(file.buffer, blobPath, file.mimetype);

      uploadedMedia.push({
        url: uploadResult.url,
        order: i,
        mediaType: PostMediaType.IMAGE,
      });
    }

    const post = await prisma.post.create({
      data: {
        userId: currentUserId,
        caption: caption || null,
        media: {
          create: uploadedMedia,
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

    return sendSuccessResponse(
      res,
      201,
      {
        ...post,
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
      },
      'Post created successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const deletePost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const post = await prisma.post.findUnique({
      where: { id: id as string },
      select: { id: true, userId: true },
    });

    if (!post) {
      return sendErrorResponse(res, 404, 'Post not found');
    }

    if (post.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to delete this post');
    }

    await prisma.post.delete({
      where: { id: id as string },
    });

    return sendSuccessResponse(res, 200, null, 'Post deleted successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getPost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const post = await prisma.post.findUnique({
      where: { id: id as string },
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

    if (!post) {
      return sendErrorResponse(res, 404, 'Post not found');
    }

    const { likes, _count, ...postData } = post;

    return sendSuccessResponse(
      res,
      200,
      {
        ...postData,
        likesCount: _count.likes,
        commentsCount: _count.comments,
        isLiked: likes.length > 0,
      },
      'Post retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getUserPosts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const [total, posts] = await Promise.all([
      prisma.post.count({
        where: { userId: userId as string },
      }),
      prisma.post.findMany({
        where: { userId: userId as string },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

    const formattedPosts = posts.map((post) => {
      const { likes, _count, ...postData } = post;
      return {
        ...postData,
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
        items: formattedPosts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'User posts retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getFeed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    // Get all users the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return sendSuccessResponse(
        res,
        200,
        {
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        'Feed retrieved successfully'
      );
    }

    const [total, posts] = await Promise.all([
      prisma.post.count({
        where: { userId: { in: followingIds } },
      }),
      prisma.post.findMany({
        where: { userId: { in: followingIds } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

    const formattedPosts = posts.map((post) => {
      const { likes, _count, ...postData } = post;
      return {
        ...postData,
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
        items: formattedPosts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Feed retrieved successfully'
    );
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const likePost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.user!.id;

    const post = await prisma.post.findUnique({
      where: { id: postId as string },
      select: { id: true, userId: true },
    });

    if (!post) {
      return sendErrorResponse(res, 404, 'Post not found');
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: {
          userId: currentUserId,
          postId: postId as string,
        },
      },
    });

    if (existingLike) {
      await prisma.postLike.delete({
        where: { id: existingLike.id },
      });
      return sendSuccessResponse(res, 200, { liked: false }, 'Post unliked successfully');
    }

    await prisma.postLike.create({
      data: {
        userId: currentUserId,
        postId: postId as string,
      },
    });

    await createNotification({
      userId: post.userId,
      actorId: currentUserId,
      type: NotificationType.LIKE_POST,
      entityId: postId as string,
    });

    return sendSuccessResponse(res, 200, { liked: true }, 'Post liked successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const unlikePost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.user!.id;

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: {
          userId: currentUserId,
          postId: postId as string,
        },
      },
    });

    if (!existingLike) {
      return sendErrorResponse(res, 404, 'Like not found');
    }

    await prisma.postLike.delete({
      where: { id: existingLike.id },
    });

    return sendSuccessResponse(res, 200, { liked: false }, 'Post unliked successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const commentPost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user!.id;

    const post = await prisma.post.findUnique({
      where: { id: postId as string },
      select: { id: true, userId: true },
    });

    if (!post) {
      return sendErrorResponse(res, 404, 'Post not found');
    }

    const comment = await prisma.postComment.create({
      data: {
        postId: postId as string,
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
      userId: post.userId,
      actorId: currentUserId,
      type: NotificationType.COMMENT_POST,
      entityId: comment.id,
    });

    return sendSuccessResponse(res, 201, comment, 'Comment added successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getPostComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const skip = (page - 1) * limit;

    const post = await prisma.post.findUnique({
      where: { id: postId as string },
      select: { id: true },
    });

    if (!post) {
      return sendErrorResponse(res, 404, 'Post not found');
    }

    const [total, comments] = await Promise.all([
      prisma.postComment.count({
        where: { postId: postId as string },
      }),
      prisma.postComment.findMany({
        where: { postId: postId as string },
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

const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const currentUserId = req.user!.id;

    const comment = await prisma.postComment.findUnique({
      where: { id: commentId as string },
      include: {
        post: {
          select: { userId: true },
        },
      },
    });

    if (!comment) {
      return sendErrorResponse(res, 404, 'Comment not found');
    }

    // Allowed if current user is comment author OR post owner
    if (comment.userId !== currentUserId && comment.post.userId !== currentUserId) {
      return sendErrorResponse(res, 403, 'You are not authorized to delete this comment');
    }

    await prisma.postComment.delete({
      where: { id: commentId as string },
    });

    return sendSuccessResponse(res, 200, null, 'Comment deleted successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export {
  createPost,
  deletePost,
  getPost,
  getUserPosts,
  getFeed,
  likePost,
  unlikePost,
  commentPost,
  getPostComments,
  deleteComment,
};
