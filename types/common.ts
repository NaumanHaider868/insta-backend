import { Request as ExpressRequest } from 'express';

interface File {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
}

interface RequestWithFormData<T> extends ExpressRequest {
  file: File;
  body: T;
}

export { RequestWithFormData, File };
