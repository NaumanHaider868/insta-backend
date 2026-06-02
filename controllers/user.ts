import { Response } from 'express';
import { appErrorResponse, sendSuccessResponse } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { prisma } from '../config';

const userProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id },
    });
    return sendSuccessResponse(res, 200, user);
  } catch (error) {
    appErrorResponse(res, error);
  }
};

export { userProfile };
