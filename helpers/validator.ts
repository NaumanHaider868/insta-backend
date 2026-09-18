import { Response, NextFunction } from 'express';
import { createValidator, ExpressJoiInstance } from 'express-joi-validation';
import Joi from 'joi';
import { deepSanitize, sendErrorResponse } from '../utils';
import { RequestWithFormData } from '../types';

class ValidatorHelper<T extends string> {
  protected validator: ExpressJoiInstance;
  protected validationSchema: Record<T, Joi.Schema>;
  protected joiValidationOptions: Joi.ValidationOptions;

  constructor(
    validationSchema: Record<T, Joi.Schema>,
    options: Joi.ValidationOptions = { allowUnknown: true }
  ) {
    this.validator = createValidator({});
    this.validationSchema = validationSchema;
    this.joiValidationOptions = options;
  }

  protected getValidator() {
    return this.validator;
  }

  public getSchema(schemaName: T): Joi.Schema {
    const schema = this.validationSchema[schemaName];
    if (!schema) throw new Error(`Schema "${schemaName}" not found`);
    return schema;
  }

  public getMiddleware(
    schemaName: T,
    options: {
      sanitizeBody?: boolean;
      isQueryParams?: boolean;
      isFormData?: boolean;
      isParams?: boolean;
    } = {
      sanitizeBody: true,
      isQueryParams: false,
      isFormData: false,
      isParams: false,
    }
  ) {
    const schema = this.getSchema(schemaName);
    return (req: RequestWithFormData, res: Response, next: NextFunction) => {
      const data = options.isParams
        ? { ...req.params, ...req.query }
        : options.isQueryParams
          ? { ...req.query, ...req.params }
          : options.isFormData
            ? req.fields || {}
            : req.body || {};

      const { error } = schema.validate(options.sanitizeBody ? deepSanitize(data) : data, {
        ...this.joiValidationOptions,
        abortEarly: false,
      });

      if (error) {
        return sendErrorResponse(res, 422, error.details.map((el) => el.message).join(', '));
      }

      next();
    };
  }
}

export default ValidatorHelper;
