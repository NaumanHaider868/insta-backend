import nodemailer from 'nodemailer';

export const mailConnector = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_NAME,
    pass: process.env.MAILTRAP_PASSWORD,
  },
});
