import { Response } from 'express';
import { handlePrismaError } from './prisma';

const formatError = (err: Error) => {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...err,
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

const appErrorResponse = (res: Response, err: Error, fallbackMessage = 'Server Error') => {
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
