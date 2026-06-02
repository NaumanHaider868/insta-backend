import { Request as ExpressRequest } from 'express';

interface RequestWithFormData<T> extends ExpressRequest {
  fields: {
    [K in keyof T]: T[K] extends File ? File : T[K] extends File[] ? File[] : T[K];
  };
}

export { RequestWithFormData };
