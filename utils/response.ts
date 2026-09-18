import { Response } from 'express';
import { handlePrismaError } from './prisma';

const toError = (err: unknown): Error => {
  return err instanceof Error ? err : new Error(String(err));
};

const formatError = (err: unknown) => {
  const error = toError(err);
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
};

const sendErrorResponse = <T>(
  res: Response,
  code: number = 400,
  errorMessage: string,
  details?: ReturnType<typeof formatError> | string,
  data?: T | undefined
) => {
  return res.status(code).send({
    status: 'error',
    error: errorMessage,
    ...(details ? { details } : {}),
    data,
  });
};
const sendSuccessResponse = <T>(
  res: Response,
  code: number,
  data: T | undefined,
  message: string = 'Successfull'
) => {
  return res.status(code).send({
    status: 'success',
    data,
    message,
  });
};

const appErrorResponse = (res: Response, err: unknown, fallbackMessage = 'Server Error') => {
  const prismaHandled = handlePrismaError(err);
  const statusCode = prismaHandled.status || 500;
  const message = prismaHandled.message || fallbackMessage;
  console.error(formatError(err));
  return sendErrorResponse(res, statusCode, message, formatError(err));
};

const missingFeilds = (res: Response) => {
  return sendErrorResponse(res, 400, 'Some feilds are missings');
};

export { sendErrorResponse, sendSuccessResponse, appErrorResponse, missingFeilds, formatError };
