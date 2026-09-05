import Joi from 'joi';
import ValidatorHelper from '../helpers/validator';

enum FollowSchema {
  Follow_User = 'Follow_User',
  Get_Followers = 'Get_Followers',
  Get_Following = 'Get_Following',
  Follow_Status = 'Follow_Status',
}

const validationSchema = {
  [FollowSchema.Follow_User]: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
  [FollowSchema.Get_Followers]: Joi.object({
    userId: Joi.string().uuid().required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
  [FollowSchema.Get_Following]: Joi.object({
    userId: Joi.string().uuid().required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
  [FollowSchema.Follow_Status]: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
};

const followValidator = new ValidatorHelper<FollowSchema>(validationSchema);

export { followValidator, FollowSchema };
