import Joi from 'joi';
import ValidatorHelper from '../helpers/validator';

enum NotificationSchema {
  Get_Notifications = 'Get_Notifications',
  Mark_Read = 'Mark_Read',
}

const validationSchema = {
  [NotificationSchema.Get_Notifications]: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
  [NotificationSchema.Mark_Read]: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const notificationValidator = new ValidatorHelper<NotificationSchema>(validationSchema);

export { notificationValidator, NotificationSchema };
