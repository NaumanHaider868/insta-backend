import { Request as ExpressRequest } from 'express';

interface File {
  fieldname: string;
  filename: string;
  encoding: string;
  mimeType: string;
  buffer: Buffer;
}

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
  file?: File;
  files?: File[] | { [fieldname: string]: File[] };
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
