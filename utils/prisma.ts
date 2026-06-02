import { Prisma } from '@prisma/client';
import { prismaErrorMessages } from '../data';
import { PrismaErrorCode } from '../enums';

const handlePrismaError = (error: unknown): { status: number; message: string } => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message =
      prismaErrorMessages[error.code as PrismaErrorCode] || 'A database error occurred.';
    return { status: 400, message };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 422,
      message: 'Validation failed. Check your input values.',
    };
  }

  return {
    status: 500,
    message: 'Unexpected server error. Try again later.',
  };
};

export { handlePrismaError };
