import { JwtPayload } from 'jsonwebtoken';
import { TokenIdentifier } from '../enums';

type Payload<T> = (T | JwtPayload) & { reference: TokenIdentifier };
interface JwtCheckResult<T> {
  isValid: boolean;
  payload: Payload<T> | null;
  error: string | null;
}

interface CheckJwtTokenOptions {
  expiredMessage: string;
  invalidMessage: string;
  reference: TokenIdentifier;
}

export type { JwtCheckResult, CheckJwtTokenOptions, Payload as JwtPayloadWithReference };
