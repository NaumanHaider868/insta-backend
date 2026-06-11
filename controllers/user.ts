import { Response } from 'express';
import { appErrorResponse, sendSuccessResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { prisma } from '../config';
import { ProfileUpdateFormData, RequestWithFormData } from '../types';
import { uploadFile } from '../services/uploadFile';

const userProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id: id as string },
    });
    return sendSuccessResponse(res, 200, user);
  } catch (error) {
    appErrorResponse(res, error);
  }
};

const uploadProfile = async (req: RequestWithFormData<ProfileUpdateFormData>, res: Response) => {
  try {
    const file = req.file;

    const data = await uploadFile(file.buffer, `profile_pics/${file.originalname}`);
    return sendSuccessResponse(res, 200, data);
  } catch (error) {
    appErrorResponse(res, error);
  }
};

export { userProfile, uploadProfile };
