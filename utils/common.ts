import { Request as ExpressRequest } from 'express';

type File = Express.Multer.File;

type RequestWithBody<T> = ExpressRequest & {
  body: T;
};

interface RequestWithParams<T extends ExpressRequest['params']> extends ExpressRequest {
  params: T;
}

interface RequestWithQuery<T extends ExpressRequest['query']> extends ExpressRequest {
  query: T;
}

interface RequestWithParamsAndBody<T extends ExpressRequest['params'], U> extends ExpressRequest {
  params: T;
  body: U;
}

interface RequestWithFormData<T = Record<string, unknown>> extends ExpressRequest {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  fields?: Record<string, unknown>;
  body: T;
}

export type {
  RequestWithBody,
  RequestWithParams,
  RequestWithQuery,
  RequestWithParamsAndBody,
  RequestWithFormData,
  File,
};
