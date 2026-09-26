import { Response } from 'express';
import { appErrorResponse, sendSuccessResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { prisma } from '../config';
import { ProfileUpdateFormData, RequestWithFormData } from '../types';
import { deleteFiles, uploadFile } from '../services';

const userProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        profile: true,
        _count: {
          select: {
            posts: true,
            reels: true,
            followers: true,
            following: true,
          },
        },
      },
    });
    if (!user) return res.status(404).send({ status: 'error', error: 'User not found' });
    return sendSuccessResponse(res, 200, user);
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const uploadProfile = async (req: RequestWithFormData<ProfileUpdateFormData>, res: Response) => {
  try {
    const file = req.file;
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).send({ status: 'error', error: 'Authentication required' });
    }
    const profile = req.body?.profile;
    const removeProfileImage = req.body?.removeProfileImage === 'true';
    if (file && removeProfileImage) {
      return res.status(400).send({ status: 'error', error: 'Choose either a new profile image or remove the current one' });
    }
    if (!file && profile === undefined && !removeProfileImage) {
      return res.status(400).send({ status: 'error', error: 'Profile details are required' });
    }
    if (typeof profile === 'string' && profile.length > 500) {
      return res.status(400).send({ status: 'error', error: 'Bio must be 500 characters or fewer' });
    }

    const previousImage = await prisma.users.findUnique({
      where: { id: userId },
      select: { profileImage: true },
    });
    const uploadedImage = file
      ? await uploadFile(file.buffer, `profiles/${userId}/${Date.now()}-${file.originalname}`, file.mimetype)
      : null;
    const user = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(uploadedImage ? { profileImage: uploadedImage.url } : {}),
        ...(removeProfileImage ? { profileImage: null } : {}),
        ...(profile !== undefined ? { profile: profile.trim() || null } : {}),
      },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        profile: true,
        _count: {
          select: {
            posts: true,
            reels: true,
            followers: true,
            following: true,
          },
        },
      },
    });
    if ((uploadedImage || removeProfileImage) && previousImage?.profileImage) {
      try {
        await deleteFiles([previousImage.profileImage]);
      } catch (deleteError) {
        console.error('Failed to remove previous profile image from blob storage', deleteError);
      }
    }
    return sendSuccessResponse(res, 200, user, 'Profile updated successfully');
  } catch (error) {
    return appErrorResponse(res, error as Error);
  }
};

const getSuggestions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const following = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    const excludedIds = [currentUserId, ...following.map(({ followingId }) => followingId)];
    const candidates = await prisma.users.findMany({
      where: { id: { notIn: excludedIds }, isVerified: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      },
    });

    const items = candidates.sort(() => Math.random() - 0.5).slice(0, 5);
    return sendSuccessResponse(res, 200, { items }, 'Suggestions retrieved successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

export { userProfile, uploadProfile, getSuggestions };
