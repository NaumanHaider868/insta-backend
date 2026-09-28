import { Response } from 'express';
import { StoryType } from '@prisma/client';
import { prisma } from '../config';
import { AuthenticatedRequest } from '../middlewares';
import { deleteFiles, uploadFile } from '../services';
import { appErrorResponse, sendErrorResponse, sendSuccessResponse } from '../utils';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_STORY_TEXT_LENGTH = 500;

const createStory = async (req: AuthenticatedRequest, res: Response) => {
  let uploadedUrl: string | null = null;
  try {
    const userId = req.user!.id;
    const type = String(req.body.type || '').toUpperCase() as StoryType;
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const background = typeof req.body.background === 'string' ? req.body.background : '#1e3a8a';
    const file = req.file;

    if (!Object.values(StoryType).includes(type)) {
      return sendErrorResponse(res, 400, 'Choose an image, video, or text story');
    }
    if (text.length > MAX_STORY_TEXT_LENGTH) {
      return sendErrorResponse(res, 400, `Story text must be ${MAX_STORY_TEXT_LENGTH} characters or fewer`);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(background)) {
      return sendErrorResponse(res, 400, 'Invalid story background color');
    }
    if (type === StoryType.TEXT && !text) {
      return sendErrorResponse(res, 400, 'Text story cannot be empty');
    }
    if (type !== StoryType.TEXT && !file) {
      return sendErrorResponse(res, 400, 'Select a media file for this story');
    }
    if (type === StoryType.IMAGE && !file?.mimetype.startsWith('image/')) {
      return sendErrorResponse(res, 400, 'Select an image for this story');
    }
    if (type === StoryType.VIDEO && !file?.mimetype.startsWith('video/')) {
      return sendErrorResponse(res, 400, 'Select a video for this story');
    }

    if (file) {
      const upload = await uploadFile(
        file.buffer,
        `stories/${userId}/${Date.now()}-${file.originalname}`,
        file.mimetype
      );
      uploadedUrl = upload.url;
    }

    const story = await prisma.story.create({
      data: {
        userId,
        type,
        mediaUrl: uploadedUrl,
        text: text || null,
        background: type === StoryType.TEXT ? background : null,
        expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
      },
    });

    return sendSuccessResponse(res, 201, story, 'Story created successfully');
  } catch (error) {
    if (uploadedUrl) {
      try {
        await deleteFiles([uploadedUrl]);
      } catch {
        // Preserve the original story creation error.
      }
    }
    return appErrorResponse(res, error as Error);
  }
};

const getStoryFeed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const visibleUserIds = [userId, ...follows.map(({ followingId }) => followingId)];
    const stories = await prisma.story.findMany({
      where: {
        userId: { in: visibleUserIds },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
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
        views: {
          where: { viewerId: userId },
          select: { id: true },
        },
        _count: { select: { views: true } },
      },
    });

    const groups = new Map<string, {
      user: (typeof stories)[number]['user'];
      isCurrentUser: boolean;
      stories: Array<Record<string, unknown>>;
      hasUnseen: boolean;
    }>();

    for (const story of stories) {
      const isCurrentUser = story.userId === userId;
      const viewed = isCurrentUser || story.views.length > 0;
      const group = groups.get(story.userId) || {
        user: story.user,
        isCurrentUser,
        stories: [],
        hasUnseen: false,
      };
      const { views, _count, ...storyData } = story;
      group.stories.push({ ...storyData, viewed, viewCount: _count.views });
      group.hasUnseen ||= !viewed;
      groups.set(story.userId, group);
    }

    return sendSuccessResponse(res, 200, { items: [...groups.values()] }, 'Stories retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const markStoryViewed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewerId = req.user!.id;
    const storyId = req.params.id as string;
    const story = await prisma.story.findFirst({
      where: { id: storyId, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!story) return sendErrorResponse(res, 404, 'Story not found or expired');
    if (story.userId === viewerId) {
      return sendSuccessResponse(res, 200, { viewed: true }, 'Your story was opened');
    }

    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: story.id, viewerId } },
      update: {},
      create: { storyId: story.id, viewerId },
    });
    return sendSuccessResponse(res, 200, { viewed: true }, 'Story marked as viewed');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getStoryViewers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storyId = req.params.id as string;
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true },
    });
    if (!story) return sendErrorResponse(res, 404, 'Story not found');
    if (story.userId !== req.user!.id) {
      return sendErrorResponse(res, 403, 'Only the story owner can view its viewers');
    }

    const views = await prisma.storyView.findMany({
      where: { storyId: story.id },
      orderBy: { viewedAt: 'desc' },
      include: {
        viewer: {
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
    return sendSuccessResponse(res, 200, { items: views }, 'Story viewers retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

export { createStory, getStoryFeed, getStoryViewers, markStoryViewed };