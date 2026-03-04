import Joi from 'joi';
import ValidatorHelper from '../helpers/validator';

enum ChatSchema {
  Send_Message = 'Send_Message',
  Get_Conversation = 'Get_Conversation',
}

const validationSchema = {
  [ChatSchema.Send_Message]: Joi.object({
    receiverId: Joi.string().uuid().required(),
    content: Joi.string().min(1).max(1000).required(),
  }),
  [ChatSchema.Get_Conversation]: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
};

const chatValidator = new ValidatorHelper<ChatSchema>(validationSchema);

export { chatValidator, ChatSchema };
