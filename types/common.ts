import { Request as ExpressRequest } from 'express';

interface File {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
}

interface RequestWithFormData<T = Record<string, unknown>> extends ExpressRequest {
  file?: File;
  files?: File[] | { [fieldname: string]: File[] };
  fields?: Record<string, unknown>;
  body: T;
}

export { RequestWithFormData, File };
