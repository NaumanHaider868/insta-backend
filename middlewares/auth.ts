import { Request, Response, NextFunction } from 'express';
import { checkJwtToken } from '../utils';
import { TokenIdentifier } from '../enums';
import { prisma } from '../config';
import { sendErrorResponse } from '../utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    userName: string;
    firstName: string;
    lastName: string;
  };
}

const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendErrorResponse(res, 401, 'Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { isValid, payload, error } = checkJwtToken<{ id: string }>(token, ['id'], {
      reference: TokenIdentifier.Login,
    });

    if (!isValid || !payload) {
      return sendErrorResponse(res, 401, error || 'Invalid token');
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
      return sendErrorResponse(res, 401, 'User not found');
    }

    if (!user.isVerified) {
      return sendErrorResponse(res, 401, 'User not verified');
    }

    req.user = user;
    next();
  } catch {
    return sendErrorResponse(res, 401, 'Authentication failed');
  }
};

export type { AuthenticatedRequest };
export { authenticate };
