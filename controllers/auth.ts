import { Request, Response } from 'express';
import {
  appErrorResponse,
  sendSuccessResponse,
  sendErrorResponse,
  hashPassword,
  checkJwtToken,
  RequestWithBody,
} from '../utils';
import { prisma } from '../config';
import { comparePassword } from '../utils';
import { getJWTToken } from '../utils';
import { TokenIdentifier } from '../enums';
import { mailConnector } from '../utils/mailConnector';
import { Users as UserSchema } from '@prisma/client';
import { LoginPayload } from '../types';

const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const existingUser = await prisma.users.findUnique({
      where: {
        email,
      },
    });
    if (existingUser) {
      const token = getJWTToken(
        { userId: existingUser.userId },
        { expiresIn: '10min', reference: TokenIdentifier.VerificationCheck }
      );
      return sendErrorResponse(res, 409, 'User already exists', token);
    }

    const user = await prisma.users.create({
      data: {
        firstName,
        lastName,
        email,
        password: await hashPassword(password),
        isVerified: false,
      },
    });
    const [emailVerificationToken, verificationCheckToken] = [
      getJWTToken(
        { userId: user.userId },
        { expiresIn: '1min', reference: TokenIdentifier.EmailVerification }
      ),
      getJWTToken(
        { userId: user.userId },
        { expiresIn: '10min', reference: TokenIdentifier.VerificationCheck }
      ),
    ];
    const verificationUrl = `${process.env.FRONTEND_BASE_URL}/verify-email?token=${emailVerificationToken}`;
    await mailConnector.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Confirm Your Email - Union',
      html: `
    <h2>Welcome to Union!</h2>
    <p>Thank you for joining our fashion community. Please confirm your email address by clicking the button below:</p>
    <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Confirm Email</a>
    <p>Once confirmed, you’ll be able to explore the latest collections, exclusive discounts, and new arrivals.</p>
    <p>If you did not create an account, you can safely ignore this email.</p>
    <p>This link will expire in 10 minutes.</p>
  `,
    });

    return sendSuccessResponse(
      res,
      200,
      { token: verificationCheckToken },
      'Registration successful! Please check your email to verify your account.'
    );
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const login = async (req: RequestWithBody<LoginPayload>, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.users.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      return sendErrorResponse(res, 400, 'Invalid Credentials');
    }
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) return sendErrorResponse(res, 400, 'Invalid Credentials');
    if (!user.isVerified) {
      const [emailVerificationToken, verificationCheckToken] = [
        getJWTToken(
          { userId: user.userId },
          { expiresIn: '10min', reference: TokenIdentifier.EmailVerification }
        ),
        getJWTToken(
          { userId: user.userId },
          { expiresIn: '10min', reference: TokenIdentifier.VerificationCheck }
        ),
      ];

      const verificationUrl = `${process.env.FRONTEND_BASE_URL}/verify-email?token=${emailVerificationToken}`;

      await mailConnector.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Confirm Your Email - Union',
        html: `
    <h2>Welcome to Union!</h2>
    <p>Thank you for joining our fashion community. Please confirm your email address by clicking the button below:</p>
    <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Confirm Email</a>
    <p>Once confirmed, you’ll be able to explore the latest collections, exclusive discounts, and new arrivals.</p>
    <p>If you did not create an account, you can safely ignore this email.</p>
    <p>This link will expire in 10 minutes.</p>
  `,
      });

      return sendSuccessResponse(
        res,
        200,
        {
          token: verificationCheckToken,
          isVerified: false,
        },
        'User not verified. Please verify first'
      );
    }

    return sendSuccessResponse(res, 200, user, 'Login Successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const { error, payload, isValid } = checkJwtToken<Pick<UserSchema, 'userId'>>(
      token,
      ['userId'],
      {
        expiredMessage: 'Verification link has expired. Please request a new one.',
        reference: TokenIdentifier.EmailVerification,
      }
    );
    if (!isValid) return sendErrorResponse(res, 401, error);

    const { userId } = payload;
    const user = await prisma.users.findUnique({
      where: { userId },
    });

    if (!user) return sendErrorResponse(res, 401, 'Invalid verification token');

    await prisma.users.update({
      where: { userId },
      data: {
        isVerified: true,
      },
    });

    sendSuccessResponse(res, 200, null, 'Email verified successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const verificationCheck = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const { error, payload, isValid } = checkJwtToken<Pick<UserSchema, 'userId'>>(
      token,
      ['userId'],
      {
        expiredMessage: 'Verification link has expired. Please request a new one.',
        reference: TokenIdentifier.VerificationCheck,
      }
    );
    if (!isValid) return sendErrorResponse(res, 401, error);
    const { userId } = payload;

    const user = await prisma.users.findUnique({
      where: { userId },
    });
    if (!user.isVerified) return sendErrorResponse(res, 400, 'User not verified');
    const authToken = getJWTToken(
      { userId },
      { expiresIn: '10min', reference: TokenIdentifier.Login }
    );
    delete user.password;
    sendSuccessResponse(res, 200, { user, token: authToken }, 'Verification complete.');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const { error, payload, isValid } = checkJwtToken<Pick<UserSchema, 'userId'>>(
      token,
      ['userId'],
      {
        expiredMessage: 'Verification link has expired. Please request a new one.',
        reference: TokenIdentifier.VerificationCheck,
      }
    );
    if (!isValid) return sendErrorResponse(res, 401, error);
    const { userId } = payload;
    const user = await prisma.users.findUnique({
      where: { userId },
    });

    const verificationToken = getJWTToken(
      { userId: user.userId },
      { expiresIn: '10min', reference: TokenIdentifier.EmailVerification }
    );

    const verificationUrl = `${process.env.FRONTEND_BASE_URL}/verify-email?token=${verificationToken}`;

    await mailConnector.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: 'Confirm Your Email - Union',
      html: `
    <h2>Welcome to Union!</h2>
    <p>Thank you for joining our fashion community. Please confirm your email address by clicking the button below:</p>
    <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Confirm Email</a>
    <p>Once confirmed, you’ll be able to explore the latest collections, exclusive discounts, and new arrivals.</p>
    <p>If you did not create an account, you can safely ignore this email.</p>
    <p>This link will expire in 10 minutes.</p>
  `,
    });

    sendSuccessResponse(res, 200, null, 'Verification email sent successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const forgetPasswordEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.users.findUnique({
      where: { email },
    });
    if (!user) return sendErrorResponse(res, 404, 'User did not exist!');
    const token = getJWTToken(
      { userId: user.userId },
      { expiresIn: '10min', reference: TokenIdentifier.ResetPassword }
    );

    await mailConnector.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Reset Your Password - Union',
      html: `
        <h2>Password Reset Request</h2>
        <p>We received a request to reset the password for your Union account. If this was you, click the button below to reset your password:</p>
        <a href="${process.env.CLIENT_URL}/reset-password?token=${token}" 
           style="padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">
           Reset Password
        </a>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <p>This link will expire in 10 minutes for your security.</p>
      `,
    });

    return sendSuccessResponse(res, 200, token, 'Please confirm the email');
  } catch (error) {
    console.log(error);
    return appErrorResponse(res, error);
  }
};

const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const { error, payload, isValid } = checkJwtToken<Pick<UserSchema, 'userId'>>(
      token,
      ['userId'],
      {
        expiredMessage: 'Verification link has expired. Please request a new one.',
        reference: TokenIdentifier.ResetPassword,
      }
    );
    if (!isValid) return sendErrorResponse(res, 401, error);
    const { userId } = payload;
    const user = await prisma.users.findUnique({
      where: { userId },
    });
    if (!user) return sendErrorResponse(res, 404, 'Invalid verification token');
    const isValidCode = await comparePassword(password, user.password);
    if (!isValidCode) return sendErrorResponse(res, 400, 'Invalid Credentials');
    await prisma.users.update({
      where: { userId: user.userId },
      data: {
        password: await hashPassword(password),
      },
    });
    delete user.password;
    delete user.verificationCode;
    delete user.userId;
    delete user.createdAt;
    delete user.updatedAt;
    sendSuccessResponse(res, 200, user, 'Password reset successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

export {
  login,
  register,
  verifyEmail,
  verificationCheck,
  resendVerificationEmail,
  forgetPasswordEmail,
  resetPassword,
};
