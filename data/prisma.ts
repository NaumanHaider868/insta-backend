// utils/prismaErrorMessages.ts

import { PrismaErrorCode } from '../enums';

const prismaErrorMessages: Record<PrismaErrorCode, string> = {
  [PrismaErrorCode.UniqueConstraintFailed]: 'That already exists. Try a different value.',
  [PrismaErrorCode.ForeignKeyConstraintFailed]: 'Invalid reference. Please check related fields.',
  [PrismaErrorCode.RecordNotFound]: 'No matching record found.',
  [PrismaErrorCode.QueryParamMissing]: 'Missing required query parameters.',
  [PrismaErrorCode.NullConstraintViolation]: 'Required field cannot be null.',
  [PrismaErrorCode.RelationViolation]: 'Relation constraint failed.',
  [PrismaErrorCode.RequiredRelationMissing]: 'Required relation is missing.',
  [PrismaErrorCode.ValueOutOfRange]: 'Value is out of allowed range.',
  [PrismaErrorCode.ConstraintViolation]: 'Input violates constraint.',
  [PrismaErrorCode.InvalidInput]: 'Invalid input. Please check your data.',
  [PrismaErrorCode.TooManyRequests]: 'Too many requests. Please try again later.',
};

export { prismaErrorMessages };
