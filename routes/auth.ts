import { Router } from 'express';
import {
  forgetPasswordEmail,
  login,
  register,
  resendVerificationEmail,
  resetPassword,
  verificationCheck,
  verifyEmail,
} from '../controllers';
import { authValidator } from '../validators';
import { AuthSchema } from '../enums';

const router = Router();
router.post('/login', authValidator.getMiddleware(AuthSchema.Login), login);
router.post('/register', authValidator.getMiddleware(AuthSchema.Register), register);
router.post('/verify-email', authValidator.getMiddleware(AuthSchema.Verify_Email), verifyEmail);
router.post(
  '/verification-check',
  authValidator.getMiddleware(AuthSchema.Verify_User),
  verificationCheck
);
router.post(
  '/resend-verification-email',
  authValidator.getMiddleware(AuthSchema.Send_Email_Again),
  resendVerificationEmail
);
router.post(
  '/request-forget-password',
  authValidator.getMiddleware(AuthSchema.Forgot_Password),
  forgetPasswordEmail
);
router.post(
  '/reset-password',
  authValidator.getMiddleware(AuthSchema.Reset_Password),
  resetPassword
);

export default router;
