import Joi from 'joi';
import ValidatorHelper from '../helpers/validator';

enum PostSchema {
  Create_Post = 'Create_Post',
  Comment_Post = 'Comment_Post',
  Get_Post = 'Get_Post',
  Get_User_Posts = 'Get_User_Posts',
  Pagination_Query = 'Pagination_Query',
}

const validationSchema = {
  [PostSchema.Create_Post]: Joi.object({
    caption: Joi.string().max(2200).allow('').optional(),
  }),
  [PostSchema.Comment_Post]: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
  }),
  [PostSchema.Get_Post]: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  [PostSchema.Get_User_Posts]: Joi.object({
    userId: Joi.string().uuid().required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
  [PostSchema.Pagination_Query]: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

const postValidator = new ValidatorHelper<PostSchema>(validationSchema);

export { postValidator, PostSchema };
