import nodemailer from 'nodemailer';

export const mailConnector = process.env.MAILTRAP_HOST && process.env.MAILTRAP_PORT
  ? nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST,
      port: Number(process.env.MAILTRAP_PORT),
      auth: {
        user: process.env.MAILTRAP_NAME,
        pass: process.env.MAILTRAP_PASSWORD,
      },
      secure: Number(process.env.MAILTRAP_PORT) === 465,
    })
  : null;

export const safeSendMail = async (mailOptions: Parameters<NonNullable<typeof mailConnector>['sendMail']>[0]) => {
  if (!mailConnector) {
    console.warn('Email sending skipped: MAILTRAP credentials are not configured.');
    return null;
  }

  try {
    return await mailConnector.sendMail(mailOptions);
  } catch (error) {
    console.warn('Email sending failed:', error instanceof Error ? error.message : error);
    return null;
  }
};
