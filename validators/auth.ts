import Joi from 'joi';
import { AuthSchema } from '../enums';
import ValidatorHelper from '../helpers/validator';

const validationSchema = {
  [AuthSchema.Login]: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  [AuthSchema.Register]: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  [AuthSchema.Forgot_Password]: Joi.object({
    email: Joi.string().required().email(),
  }),
  [AuthSchema.Reset_Password]: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().required().min(8),
  }),
  [AuthSchema.Verify_Email]: Joi.object({
    token: Joi.string().required(),
  }),
  [AuthSchema.Verify_User]: Joi.object({
    token: Joi.string().required(),
  }),
  [AuthSchema.Send_Email_Again]: Joi.object({
    token: Joi.string().required(),
  }),
  [AuthSchema.Verification_Code]: Joi.object({
    token: Joi.string().required(),
    pin: Joi.string().required().length(6),
  }),
};

const authValidator = new ValidatorHelper<AuthSchema>(validationSchema);

export { authValidator };
