import { Request as ExpressRequest } from 'express';

interface File {
  fieldname: string;
  filename: string;
  encoding: string;
  mimeType: string;
  buffer: Buffer;
}

interface RequestWithBody<T> extends ExpressRequest {
  body: T;
}

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

interface RequestWithFormData<T> extends ExpressRequest {
  fields: {
    [K in keyof T]: T[K] extends File ? File : T[K] extends File[] ? File[] : T[K];
  };
}

export type {
  RequestWithBody,
  RequestWithParams,
  RequestWithQuery,
  RequestWithParamsAndBody,
  RequestWithFormData,
  File,
};
