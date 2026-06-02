import jwt, { SignOptions } from 'jsonwebtoken';
import { TokenIdentifier } from '../enums';
import { CheckJwtTokenOptions, JwtCheckResult, JwtPayloadWithReference } from '../types';

const getJWTToken = <T extends object>(
  payload: T,
  { reference, ...options }: SignOptions & { reference: TokenIdentifier }
): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ ...payload, reference } as object, process.env.JWT_SECRET, options);
};

const checkJwtToken = <T extends object>(
  token: string,
  payloadCheck: string[] = [],
  {
    expiredMessage = 'Expired token',
    invalidMessage = 'Invalid or expired token',
    reference,
  }: Partial<CheckJwtTokenOptions> = {}
): JwtCheckResult<T> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayloadWithReference<T>;
    const checks = ['reference', ...payloadCheck];
    for (const key of checks) {
      if (!(key in decoded)) {
        return {
          isValid: false,
          payload: decoded,
          error: invalidMessage,
        };
      }
    }

    if (reference && decoded.reference !== reference) {
      return {
        isValid: false,
        payload: decoded,
        error: 'This token is not valid for the expected purpose',
      };
    }

    return {
      isValid: true,
      payload: decoded,
      error: null,
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      payload: null,
      error: expiredMessage ?? (err as Error)?.message ?? invalidMessage,
    };
  }
};

const getVerifyCode = () => {
  const token = Math.floor(100000 + Math.random() + 900000).toString();
  return token;
};

export { getJWTToken, checkJwtToken, getVerifyCode };
