import Joi from 'joi';
import ValidatorHelper from '../helpers/validator';

enum ReelSchema {
  Create_Reel = 'Create_Reel',
  Comment_Reel = 'Comment_Reel',
  Get_Reel = 'Get_Reel',
  Get_User_Reels = 'Get_User_Reels',
  Pagination_Query = 'Pagination_Query',
}

const validationSchema = {
  [ReelSchema.Create_Reel]: Joi.object({
    caption: Joi.string().max(2200).allow('').optional(),
  }),
  [ReelSchema.Comment_Reel]: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
  }),
  [ReelSchema.Get_Reel]: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  [ReelSchema.Get_User_Reels]: Joi.object({
    userId: Joi.string().uuid().required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
  [ReelSchema.Pagination_Query]: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

const reelValidator = new ValidatorHelper<ReelSchema>(validationSchema);

export { reelValidator, ReelSchema };
